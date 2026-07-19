# BUILD: 2026-07-15T04:30 rev2 (cache-bust: dong/ho 파라미터 반영 강제 재배포)
"""
IROS 등기고유번호 API 리졸버 (순수 requests, Playwright 불필요)
================================================================
개발자도구 Network 분석으로 확정된 내부 API를 직접 호출한다.

[확정된 API — 실측 근거]
  POST https://www.iros.go.kr/biz/Pr20ViaRlrgSrchCtrl/retrieveSmplSrchList.do
  Content-Type: application/json
  응답: application/json
  세션 쿠키: PR20SESSIONID 등 (첫 방문 시 발급)

[파라미터 — 쿠키 chk_input_save_simpl 디코딩으로 확정]
  swrd         = 주소(시/도 제외)  예: "서초구 서초동 967"
  admin_regn1  = 시/도            예: "서울특별시"
  rgs_rec_stat = 등기기록상태       "현행"
  addr_cls     = "3" (지번검색)
  kind_cls     = "all" (부동산구분 전체)
  pageUnit     = 직접검색 10 / 전체수집 1000 (미지원 시 500 → 100 → 10 폴백)
  (나머지는 빈 문자열 기본값)

[장점]
- Playwright/브라우저/EC2 헤드리스 크로미움 불필요 → 초경량, 빠름
- requests만 있으면 되므로 Vercel 서버리스에도 배포 가능

[주의]
- 세션 쿠키를 첫 방문(GET)으로 받아야 함. requests.Session이 이를 처리.
- 일부 쿠키가 JS로만 생성되면 이 방식이 실패할 수 있음 → 그때는 RPA(iros_resolver)로 폴백.
- 응답 JSON 구조(고유번호 필드명)는 실접속으로 최종 확인 필요. 여러 후보 키를 탐색하고,
  못 찾으면 응답 전체 텍스트에서 14자리 정규식으로 폴백 추출.
"""

import re
import sys
import time
import argparse
import hashlib
import json
from typing import Optional

try:
    import requests
except ImportError:
    print("의존성 필요: pip install requests", file=sys.stderr)
    raise

# iros_resolver의 시/도 매핑·정규화·데이터클래스 재사용 (중복 방지)
from iros_resolver import (
    ResolveResult, normalize_sido, strip_sido,
)

BASE = "https://www.iros.go.kr"
ENTRY = f"{BASE}/index.jsp"
SEARCH_API = f"{BASE}/biz/Pr20ViaRlrgSrchCtrl/retrieveSmplSrchList.do"

DIRECT_SEARCH_PAGE_UNIT = 10
FULL_COLLECT_PAGE_UNIT = 1000
PAGE_UNIT_FALLBACKS = (1000, 500, 100, 10)
MAX_COLLECTION_PAGES = 100
MAX_COLLECTION_SECONDS = 45.0
COLLECTOR_VERSION = "iros-collector-v4"
PARSER_VERSION = "iros-parser-v4"
MATCHER_VERSION = "iros-matcher-v5"

import re as _re_html
_TAG_RE = _re_html.compile(r"<[^>]+>")


def _strip_html(s: str) -> str:
    """소재지 필드(real_indi_cont 등)에 섞인 <span> 태그 제거."""
    if not s:
        return ""
    return _re_html.sub(_TAG_RE, "", str(s)).strip()


# 응답 JSON 실측 구조 (2026-07 확인):
#   dataList[].pin_land        고유번호 18자리(무하이픈) → 앞14자리가 화면표시
#   dataList[].real_indi_cont  소재지(HTML 태그 섞임)
#   dataList[].build_name      건물명
#   dataList[].buld_no_buld    동 번호,  buld_no_room 호 번호,  buld_no_floor 층
#   dataList[].use_cls_cd      등기상태(현행/폐쇄)
#   paginationInfo.totalRecordCount  총건수
UNIQUE_KEY_CANDIDATES = ["pin_land", "pin", "real_pin", "realPin", "unique_no"]
STATE_KEY_CANDIDATES = ["use_cls_cd", "rgs_rec_stat", "등기상태", "state"]
SOJAE_KEY_CANDIDATES = ["real_indi_cont", "real_indi_cont_detail", "rd_addr", "rd_addr_detail", "addr"]
BULDNM_KEY_CANDIDATES = ["build_name", "buld_name", "건물명"]

# 화면표시 고유번호: 4-4-6 (하이픈) 또는 무하이픈 14~18자리
UNIQUE_NO_HYPHEN_RE = re.compile(r"\b(\d{4})\s*-\s*(\d{4})\s*-\s*(\d{6})\b")
PIN_RAW_RE = re.compile(r"\b(\d{14,18})\b")  # pin_land 등 무하이픈


def _fmt_pin(raw: str) -> str:
    """무하이픈 pin(14~18자리) → 화면표시 14자리 하이픈 형식 (4-4-6).
    18자리면 뒤 4자리(일련번호)를 떼고 앞 14자리 사용."""
    digits = re.sub(r"\D", "", raw)
    core = digits[:14]  # 앞 14자리가 화면표시 고유번호
    if len(core) == 14:
        return f"{core[:4]}-{core[4:8]}-{core[8:14]}"
    return raw  # 예외적 길이는 원본 유지


def _extract_sigungu(address: str) -> str:
    """정제주소에서 시군구 토큰 추출 (강남구, 성남시 분당구 등).
    admin_regn1=all이므로 swrd에 시군구를 넣어 지역 특정."""
    sido = normalize_sido(address)
    base = strip_sido(address, sido)  # 시도 뗀 나머지
    # 앞에서부터 '시/군/구'로 끝나는 토큰들을 시군구로 수집 (성남시 분당구 = 2토큰)
    tokens = base.split()
    sigungu = []
    for t in tokens:
        if t.endswith(("시", "군", "구")):
            sigungu.append(t)
        elif sigungu:
            break  # 시군구 뒤 첫 비-시군구 토큰에서 중단
    return " ".join(sigungu)


def _unit_display(value, kind):
    """IROS 검색어용 표시값. 비교키와 달리 선행 0·하이픈·문자를 보존한다."""
    raw = _strip_html(str(value or "")).strip()
    raw = re.sub(r"\s+", "", raw)
    raw = re.sub(r"^제", "", raw)
    raw = re.sub(r"(동|호)$", "", raw)
    if kind == "dong" and re.fullmatch(r"(?:\d{1,6}|[A-Za-z]|[가-힣])", raw):
        return raw.upper()
    if kind == "ho" and re.fullmatch(r"(?:\d+(?:-\d+)*|[A-Za-z]\d+(?:-\d+)*)", raw):
        return raw.upper()
    return ""


def _build_swrd(address: str, dong: str = "", ho: str = "", buld_name: str = "") -> str:
    """검색어(swrd) 조립 — 정제된 최종 지번주소를 온전히 사용.
    핵심: 지번(법정동+번지)을 축으로 유지 → IROS가 그 필지로 특정 → 타 지번/타 건물 혼입 방지.
    형태: '시군구 법정동 번지 [건물명] [N동] [N호]'
    (지번을 빼고 건물명만 넣으면 같은 이름 다른 아파트가 섞임 — 예: 영등포푸르지오 vs 당산푸르지오)"""
    sido = normalize_sido(address)
    base = strip_sido(address, sido).strip()  # 시도 뗀 정제 지번주소 (예: '영등포구 영등포동 647')
    parts = [base]  # 정제 지번주소를 그대로 축으로

    # 건물명: 지번주소에 이미 포함돼 있지 않으면 추가 (juso jibunAddr가 건물명 붙여주는 경우 중복 방지)
    if buld_name:
        bn = buld_name.strip()
        if bn and bn not in base:
            parts.append(bn)

    d = _unit_display(dong, "dong")
    if d:
        parts.append(f"{d}동")
    h = _unit_display(ho, "ho")
    if h:
        parts.append(f"{h}호")
    return " ".join(parts).strip()


def _build_payload(address: str, dong: str = "", ho: str = "", buld_name: str = "",
                   page_index="", page_unit=DIRECT_SEARCH_PAGE_UNIT) -> dict:
    """정제주소 → 검색 API 요청 본문.
    2026-07-13 개정: 이 함수를 호출하는 resolve_one_api()는 이제 dong/ho를
    항상 빈 문자열로 넘긴다(swrd에 동/호를 안 넣기로 함 — 이유는
    resolve_one_api docstring 참고). 아래 buld_no_buld/buld_no_room을
    "swrd에 포함하므로 비움"이라 적어둔 옛 주석은 더 이상 사실이 아니다 —
    지금은 그냥 항상 비어있다(구조화 필드 자체를 안 씀). 이 함수 자체는
    dong/ho 인자를 받는 범용 형태로 남겨둠(다른 호출부 대비)."""
    swrd = _build_swrd(address, dong=dong, ho=ho, buld_name=buld_name)
    return {
        "conn_menu_cls_cd": "01",
        "prgs_mode_cls_cd": "01",
        "inet_srch_cls_cd": "PR01",
        "prgs_stg_cd": "",
        "move_cls": "",
        "swrd": swrd,
        "addr_cls": "3",          # 지번검색
        "kind_cls": "all",        # 부동산구분 전체
        "land_bing_yn": "",
        "rgs_rec_stat": "현행",
        "admin_regn1": "all",     # 시/도 코드 매칭 회피(강원특별자치도 등 명칭변경 안전). swrd의 시군구로 지역 특정
        "admin_regn2": "",
        "admin_regn3": "",
        "lot_no": "",
        "buld_name": "",          # swrd에 건물명 포함하므로 별도 필드는 비움
        "buld_no_buld": "",       # 구조화 필드 미사용(위 docstring 참고) — 매번 빈값
        "buld_no_room": "",       # 구조화 필드 미사용(위 docstring 참고) — 매번 빈값
        "rd_name": "",
        "rd_buld_no": "",
        "rd_buld_no2": "",
        "issue_cls": "5",
        "pageIndex": page_index,
        "pageUnit": page_unit,          # 직접검색 10 / 전체수집 1000부터 호환 폴백
        "cmort_flag": "",
        "kap_seq_flag": "",
        "trade_seq_flag": "",
        "etdoc_sel_yn": "",
        "show_cls": "",
        "real_pin_con": "",
        "svc_cls_con": "",
        "item_cls_con": "",
        "judge_enr_cls_con": "",
        "cmort_cls_con": "",
        "trade_cls_con": "",
        "extend_srch": "N",
        "usg_cls_con": "",
    }


def _pick(d: dict, keys):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return str(d[k])
    return ""


def _walk_records(obj):
    """응답 JSON에서 고유번호(하이픈 또는 무하이픈)를 포함한 레코드(dict) 재귀 수집."""
    found = []
    if isinstance(obj, dict):
        joined = " ".join(str(v) for v in obj.values() if isinstance(v, (str, int)))
        if UNIQUE_NO_HYPHEN_RE.search(joined) or PIN_RAW_RE.search(joined):
            found.append(obj)
        for v in obj.values():
            found.extend(_walk_records(v))
    elif isinstance(obj, list):
        for it in obj:
            found.extend(_walk_records(it))
    return found


# 자유문구의 한글 법정동(예: 서초동)을 한글 건물동으로 오인하지 않도록
# 한글 한 글자 동은 전용 buld_no_buld에서만 받고, 폴백은 숫자·영문만 허용한다.
_UNIT_DONG_NUM_RE = re.compile(r"제?(\d+)동")
_UNIT_DONG_ALPHA_RE = re.compile(r"(?:^|[^A-Za-z])제?([A-Za-z])동")
_UNIT_HO_RE = re.compile(r"제?([A-Za-z]?\d+(?:-\d+)*)호")


def _extract_unit_from_text(rec: dict):
    """레코드 텍스트(부동산표시 등)에서 동·호를 추출하는 폴백(2026-07-13 추가).

    실측: IROS 응답에서 buld_no_buld/buld_no_room 전용 필드가 비어 오는 경우가
    있고, 동·호는 부동산표시 문장 안에 "제 1 0 1 동 제 1 층 제 103호" 처럼
    (숫자 사이에 공백까지 섞여) 박혀 있다. 공백을 모두 제거한 뒤 '숫자+동',
    '숫자+호'를 뽑는다. '반포동' 같은 법정동은 앞이 숫자가 아니므로 매칭되지
    않고, '제1층'의 층도 대상이 아니라 안전하다.
    """
    # 필드들을 합친 뒤 공백을 제거하면 한 필드의 말미 숫자와 다음 필드의
    # 법정동이 붙어 가짜 건물동이 생긴다(예: 324 + 동교동 → 324동).
    # 실제 표시문구 필드 안에서만 공백을 제거하여 교차필드 오염을 막는다.
    text_keys = (
        "rd_addr_detail", "real_indi_cont_detail", "real_indi_cont",
        "addr_detail", "detail", "sojae", "addItem",
    )
    dong = ho = ""
    for key in text_keys:
        value = rec.get(key)
        if value in (None, ""):
            continue
        flat = re.sub(r"\s+", "", _strip_html(str(value)))
        d = _UNIT_DONG_NUM_RE.search(flat) or _UNIT_DONG_ALPHA_RE.search(flat)
        h = _UNIT_HO_RE.search(flat)
        dong = dong or (d.group(1) if d else "")
        ho = ho or (h.group(1) if h else "")
        if dong and ho:
            break
    return dong, ho


def _rec_to_cand(rec: dict) -> Optional[dict]:
    """레코드 dict → 후보. pin_land(무하이픈) 우선. 소재지 HTML 제거, 동·호·층 포함."""
    pin = _pick(rec, UNIQUE_KEY_CANDIDATES)
    uno = None
    if pin:
        uno = _fmt_pin(pin)
    else:
        blob = " ".join(str(v) for v in rec.values() if isinstance(v, (str, int)))
        mh = UNIQUE_NO_HYPHEN_RE.search(blob)
        if mh:
            uno = f"{mh.group(1)}-{mh.group(2)}-{mh.group(3)}"
        else:
            mr = PIN_RAW_RE.search(blob)
            if mr:
                uno = _fmt_pin(mr.group(1))
    if not uno:
        return None
    sojae = _strip_html(_pick(rec, SOJAE_KEY_CANDIDATES))
    buldnm = _pick(rec, BULDNM_KEY_CANDIDATES)
    dong = str(rec.get("buld_no_buld", "") or "")
    room = str(rec.get("buld_no_room", "") or "")
    inner = str(rec.get("buld_no_inner", "") or "")
    ho = room or inner
    floor = str(rec.get("buld_no_floor", "") or "")
    # 전용 필드가 비어있으면 부동산표시 텍스트에서 폴백 추출(위 함수 주석 참고)
    if not dong or not ho:
        td, th = _extract_unit_from_text(rec)
        dong = dong or td
        ho = ho or th
    # 지번 정보 (번지 필터용): lot_no=본번, addItem="법정동 번지"
    lot_no = str(rec.get("lot_no", "") or "")
    add_item = _strip_html(str(rec.get("addItem", "") or ""))
    # 집합건물이면 부동산구분을 "집합건물", 아니면 빈값(토지/건물은 목록에 따로)
    real_cls_cd = str(rec.get("real_cls_cd", "") or "").strip()
    gubun = real_cls_cd or _pick(rec, ["real_cls_nm", "부동산구분"])
    if not gubun:
        gubun = "집합건물" if ho else ""
    return {
        "unique_no": uno,
        "gubun": gubun,
        "real_cls_cd": real_cls_cd,
        "state": _pick(rec, STATE_KEY_CANDIDATES),
        "sojae": sojae,
        "buldnm": buldnm,
        "dong": dong, "ho": ho, "floor": floor,
        "lot_no": lot_no, "add_item": add_item,
        "unit_source": {
            "dong": "buld_no_buld" if rec.get("buld_no_buld") else "detail_text",
            "ho": "buld_no_room" if room else (
                "buld_no_inner" if inner else "detail_text"
            ),
        },
    }


def _parse_json_response_with_meta(data):
    """응답 JSON을 파싱하고 원본행·파싱행·고유후보 수를 분리해 반환한다."""
    out, seen = [], set()

    # 1순위: 확정된 dataList 구조
    records = []
    if isinstance(data, dict) and isinstance(data.get("dataList"), list):
        records = data["dataList"]
    else:
        records = _walk_records(data)

    parsed_record_count = 0
    for rec in records:
        if not isinstance(rec, dict):
            continue
        c = _rec_to_cand(rec)
        if c:
            parsed_record_count += 1
            if c["unique_no"] not in seen:
                seen.add(c["unique_no"])
                out.append(c)

    # 폴백: 아무것도 못 찾으면 전체 텍스트에서 번호
    if not out:
        import json as _json
        text = _json.dumps(data, ensure_ascii=False)
        for m in UNIQUE_NO_HYPHEN_RE.finditer(text):
            uno = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            if uno not in seen:
                seen.add(uno)
                out.append({"unique_no": uno, "gubun": "", "state": "", "sojae": ""})
    raw_record_count = len(records)
    schema_keys = sorted({str(key) for rec in records if isinstance(rec, dict)
                          for key in rec.keys()})
    schema_fingerprint = hashlib.sha256(
        json.dumps(schema_keys, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return out, {
        "raw_record_count": raw_record_count,
        "parsed_record_count": parsed_record_count,
        "unique_candidate_count": len(out),
        "parse_error_count": max(0, raw_record_count - parsed_record_count),
        "schema_fingerprint": schema_fingerprint,
    }


def _parse_json_response(data) -> list:
    """하위 호환용 후보 리스트 반환."""
    return _parse_json_response_with_meta(data)[0]


def make_session() -> requests.Session:
    """세션 생성 + 첫 방문으로 쿠키(PR20SESSIONID 등) 획득."""
    s = requests.Session()
    s.headers.update({
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36"),
        "Accept": "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Origin": BASE,
        "Referer": ENTRY,
    })
    try:
        s.get(ENTRY, timeout=15)  # 세션 쿠키 발급
    except Exception:
        pass
    return s


def _strip_trailing_buldname(address: str) -> str:
    """지번주소 뒤에 자연스레 붙어있는 건물명을 잘라내 순수
    '시도 시군구 법정동 번지'만 남긴다(2026-07-13 추가).
    juso jibunAddr는 보통 '...법정동 번지 건물명' 형태로 오는데(예:
    '서울특별시 영등포구 영등포동 647 영등포푸르지오'), buld_name 인자를
    빈 값으로 넘겨도 이 건물명은 address 자체에 이미 포함돼 있어서 그대로
    검색어에 실린다. IROS 등기부 등록명이 juso 건물명과 다른 경우(예:
    2006년 개명 전 '대우드림타운') swrd에 이 이름이 남아있으면 매칭이
    안 될 수 있어, 1차 시도만큼은 이 부분까지 제거해 순수 지번으로 검색한다.
    번지를 못 찾으면(형식이 다른 주소 등) 원본을 그대로 반환 — 안전 우선."""
    dong_m = re.search(r"([가-힣]+(?:동|가|리))(?:\s|$)", address)
    if not dong_m:
        return address
    rest = address[dong_m.end():]
    b_m = re.match(r"\s*(\d+(?:-\d+)?)", rest)
    if not b_m:
        return address
    cut = dong_m.end() + b_m.end()
    return address[:cut].strip()


def _extract_dong_beonji(address: str):
    """정제주소에서 법정동명 + 번지(본번-부번) 추출.
    예: '서울특별시 영등포구 영등포동 647' → ('영등포동', '647')"""
    dong_m = re.search(r"([가-힣]+(?:동|가|리))(?:\s|$)", address)
    dong = dong_m.group(1) if dong_m else ""
    beonji = ""
    if dong_m:
        rest = address[dong_m.end():]
        b_m = re.search(r"(\d+(?:-\d+)?)", rest)
        if b_m:
            beonji = b_m.group(1)
    return dong, beonji


def _match_lot(c, want_dong, want_beonji):
    """후보 지번이 정제 지번과 일치하는지. addItem/sojae/lot_no로 대조. 본번 비교."""
    if not want_beonji:
        return True
    for value in (c.get("add_item"), c.get("sojae")):
        match = re.search(
            r"([0-9A-Za-z가-힣]+(?:동\d*가|동|가|리))\s*(?:산\s*)?(\d+(?:-\d+)?)",
            str(value or ""),
        )
        if match:
            if want_dong and match.group(1) != want_dong:
                return False
            return match.group(2) == want_beonji
    candidate_lot = str(c.get("lot_no") or "").strip()
    if candidate_lot:
        return candidate_lot == want_beonji
    hay = f"{c.get('add_item','')} {c.get('sojae','')}"
    wanted = re.escape(want_beonji)
    if re.search(rf"(?<!\d){wanted}(?![-\d])", hay):
        return True
    want_main = want_beonji.split("-")[0]
    nums = re.findall(r"\d+", hay)
    if want_dong and want_dong in hay:
        return want_main in nums
    return want_main in nums


def _unit_key(value, kind="unit"):
    """동·호 비교키. 숫자 선행 0은 제거하되 알파벳·한글 동과 하이픈 호는 보존."""
    raw = _strip_html(str(value or "")).strip()
    raw = re.sub(r"\s+", "", raw)
    raw = re.sub(r"^제", "", raw)
    raw = re.sub(r"(동|호)$", "", raw)
    if not raw:
        return ""
    if kind == "dong" and re.fullmatch(r"0+", raw):
        return ""
    if kind == "dong" and re.fullmatch(r"[A-Za-z]", raw):
        return raw.upper()
    if kind == "dong" and re.fullmatch(r"[가-힣]", raw):
        return raw
    if re.fullmatch(r"\d+", raw):
        return str(int(raw))
    if kind == "ho" and re.fullmatch(r"\d+(?:-\d+)+", raw):
        return "-".join(str(int(x)) for x in raw.split("-"))
    if kind == "ho" and re.fullmatch(r"[A-Za-z]\d+(?:-\d+)?", raw):
        return raw.upper()
    return raw.upper()


_DONG_ALIASES = {
    "A": "A", "에이": "A",
    "B": "B", "비": "B",
}


def _dong_alias_key(value):
    key = _unit_key(value, "dong")
    return _DONG_ALIASES.get(key, key)


def _candidate_unit_variants(candidate):
    raw_dong = str(candidate.get("dong") or "").strip()
    raw_ho = str(candidate.get("ho") or "").strip()
    variants = [{
        "dong": _dong_alias_key(raw_dong),
        "ho": _unit_key(raw_ho, "ho"),
        "source": "direct",
    }]
    room = re.fullmatch(r"([A-Za-z가-힣]+)-(\d+(?:-\d+)*)", raw_ho)
    tokens = [
        _dong_alias_key(token)
        for token in re.split(r"[,/·]+", raw_dong)
        if _dong_alias_key(token)
    ]
    if room:
        prefixed_dong = _dong_alias_key(room.group(1))
        if prefixed_dong and prefixed_dong in tokens:
            variants.insert(0, {
                "dong": prefixed_dong,
                "ho": _unit_key(room.group(2), "ho"),
                "source": "composite_dong_room_prefix",
            })
    unique = []
    for variant in variants:
        if not any((v["dong"], v["ho"]) == (variant["dong"], variant["ho"])
                   for v in unique):
            unique.append(variant)
    return unique


def _match_unit(c, dong, ho):
    want_d = _dong_alias_key(dong)
    want_h = _unit_key(ho, "ho")
    return any(
        (not want_d or variant["dong"] == want_d)
        and (not want_h or variant["ho"] == want_h)
        for variant in _candidate_unit_variants(c)
    )


def _candidate_has_no_dong(candidate):
    return all(not variant["dong"] for variant in _candidate_unit_variants(candidate))


def _property_class_key(candidate):
    """IROS 부동산구분을 비교 가능한 세 종류로만 정규화한다."""
    raw = str(candidate.get("real_cls_cd") or candidate.get("gubun") or "").strip()
    if "집합" in raw:
        return "집합건물"
    if "토지" in raw:
        return "토지"
    if "건물" in raw:
        return "건물"
    return ""


def _filter_expected_property_class(candidates, expected):
    """기대 구분이 확인된 후보만 반환한다. 미확인은 자동확정에 사용하지 않는다."""
    if not expected:
        return list(candidates), True
    matched = [c for c in candidates if _property_class_key(c) == expected]
    return matched, bool(matched)


def _total_record_count(data):
    """응답 어디에 있든 paginationInfo.totalRecordCount를 정수로 읽는다."""
    if isinstance(data, dict):
        pi = data.get("paginationInfo")
        if isinstance(pi, dict):
            try:
                return int(pi.get("totalRecordCount"))
            except (TypeError, ValueError):
                pass
        for v in data.values():
            n = _total_record_count(v)
            if n is not None:
                return n
    elif isinstance(data, list):
        for v in data:
            n = _total_record_count(v)
            if n is not None:
                return n
    return None


def _post_search(session, payload, timeout):
    last_exc = None
    for attempt in range(3):
        try:
            r = session.post(
                SEARCH_API, json=payload,
                headers={"Content-Type": "application/json; charset=UTF-8"},
                timeout=timeout,
            )
            if r.status_code != 200:
                return None, r.status_code
            try:
                return r.json(), 200
            except ValueError:
                return {"_raw": r.text}, 200
        except (requests.ConnectionError, requests.Timeout) as exc:
            last_exc = exc
            if attempt < 2:
                time.sleep(0.5 * (attempt + 1))
    if last_exc:
        raise last_exc
    return None, 500


def _collection_meta(page_unit, **overrides):
    meta = {
        "complete": False,
        "total_count": None,
        "received_count": 0,
        "raw_received_count": 0,
        "pages_fetched": 0,
        "expected_pages": None,
        "effective_page_unit": page_unit,
        "requested_page_unit": page_unit,
        "capability_source": "REQUEST",
        "page_error": False,
        "repeated_page": False,
        "collection_deferred": False,
        "deferred_reason": "",
        "elapsed_seconds": 0.0,
        "query_scope": "EXACT_LOT",
        "collector_version": COLLECTOR_VERSION,
    }
    meta.update(overrides)
    return meta


def _collect_search(address, buld_name="", session=None, timeout=20.0,
                    page_unit=FULL_COLLECT_PAGE_UNIT, allow_session_retry=True,
                    _started_at=None, _requested_page_unit=None):
    """같은 세션에서 전 페이지를 모으고 완전성을 증명한다."""
    active = session or make_session()
    started_at = _started_at if _started_at is not None else time.monotonic()
    requested_page_unit = (
        _requested_page_unit if _requested_page_unit is not None else page_unit
    )
    capability_source = "REQUEST"
    session_page_unit = getattr(active, "_iros_page_unit", None)
    if (page_unit == FULL_COLLECT_PAGE_UNIT
            and isinstance(session_page_unit, int)
            and session_page_unit > 0):
        page_unit = session_page_unit
        capability_source = "SESSION"
    base_payload = _build_payload(address, dong="", ho="", buld_name=buld_name,
                                  page_index="", page_unit=page_unit)
    data, code = _post_search(active, base_payload, timeout)
    if code in (401, 403) and allow_session_retry:
        active = make_session()
        return _collect_search(
            address, buld_name=buld_name, session=active, timeout=timeout,
            page_unit=page_unit, allow_session_retry=False,
            _started_at=started_at,
            _requested_page_unit=requested_page_unit,
        )
    if data is None or code != 200:
        return data, code, _collection_meta(
            page_unit, session_retried=not allow_session_retry,
            requested_page_unit=requested_page_unit,
            capability_source=capability_source,
            elapsed_seconds=time.monotonic() - started_at,
        ), active
    if isinstance(data, dict) and "_raw" in data:
        return data, code, _collection_meta(
            page_unit, pages_fetched=1, parse_error=True,
            requested_page_unit=requested_page_unit,
            capability_source=capability_source,
            elapsed_seconds=time.monotonic() - started_at,
        ), active
    if isinstance(data, dict) and data.get("nrsMessageCd"):
        message_value = str(data.get("nrsMessageValue") or "")
        if "서비스 점검" in message_value or "이용 가능 시간대" in message_value:
            return data, 503, _collection_meta(
                page_unit, pages_fetched=1, service_unavailable=True,
                service_message=message_value,
                requested_page_unit=requested_page_unit,
                capability_source=capability_source,
                elapsed_seconds=time.monotonic() - started_at,
            ), active

    first_rows = data.get("dataList") if isinstance(data, dict) else None
    if not isinstance(first_rows, list):
        first_rows = []
    total = _total_record_count(data)

    # IROS 배포별로 허용 pageUnit이 다르다. 큰 단위가 빈 구조를 반환하면
    # 1000 → 500 → 100 → 10 순으로 낮추고, 실제 허용 단위에서 페이지를 순회한다.
    if (total is None and not first_rows
            and page_unit in PAGE_UNIT_FALLBACKS
            and page_unit != DIRECT_SEARCH_PAGE_UNIT):
        pos = PAGE_UNIT_FALLBACKS.index(page_unit)
        return _collect_search(
            address, buld_name=buld_name, session=active, timeout=timeout,
            page_unit=PAGE_UNIT_FALLBACKS[pos + 1],
            allow_session_retry=allow_session_retry,
            _started_at=started_at,
            _requested_page_unit=requested_page_unit,
        )

    all_rows = list(first_rows)
    pages = 1
    page_error = False
    repeated_page = False
    effective_page_unit = page_unit
    if total is not None and first_rows and len(first_rows) < total:
        # 서버가 요청값보다 작은 단위로 조용히 제한하는 경우 실수신 단위를 따른다.
        effective_page_unit = len(first_rows)
    if total is not None:
        try:
            active._iros_page_unit = effective_page_unit
        except (AttributeError, TypeError):
            pass
        if capability_source != "SESSION":
            capability_source = "NEGOTIATED"
    expected_pages = None
    if total is not None and effective_page_unit > 0:
        expected_pages = max(
            1, (total + effective_page_unit - 1) // effective_page_unit
        )
    collection_deferred = bool(
        expected_pages is not None and expected_pages > MAX_COLLECTION_PAGES
    )
    deferred_reason = "PAGE_BUDGET" if collection_deferred else ""
    seen_pages = set()
    if first_rows:
        seen_pages.add(tuple(str(x.get("pin_land", "")) for x in first_rows[:5]
                             if isinstance(x, dict)))

    # 첫 요청은 pageIndex 빈값이다. 다음 페이지는 2부터 요청한다.
    page_index = 2
    while (not collection_deferred
           and total is not None
           and len(all_rows) < total):
        if time.monotonic() - started_at >= MAX_COLLECTION_SECONDS:
            collection_deferred = True
            deferred_reason = "TIME_BUDGET"
            break
        payload = dict(base_payload)
        payload["pageIndex"] = str(page_index)
        nxt, nxt_code = _post_search(active, payload, timeout)
        if nxt_code in (401, 403) and allow_session_retry:
            fresh = make_session()
            return _collect_search(
                address, buld_name=buld_name, session=fresh, timeout=timeout,
                page_unit=page_unit, allow_session_retry=False,
                _started_at=started_at,
                _requested_page_unit=requested_page_unit,
            )
        if nxt is None or nxt_code != 200 or (isinstance(nxt, dict) and "_raw" in nxt):
            page_error = True
            break
        rows = nxt.get("dataList") if isinstance(nxt, dict) else None
        if not isinstance(rows, list) or not rows:
            page_error = True
            break
        fingerprint = tuple(str(x.get("pin_land", "")) for x in rows[:5]
                            if isinstance(x, dict))
        if fingerprint and fingerprint in seen_pages:
            repeated_page = True
            break
        if fingerprint:
            seen_pages.add(fingerprint)
        all_rows.extend(rows)
        pages += 1
        page_index += 1

    if isinstance(data, dict):
        data = dict(data)
        data["dataList"] = all_rows
    complete = (
        total is not None
        and len(all_rows) == total
        and pages == expected_pages
        and not page_error
        and not repeated_page
        and not collection_deferred
    )
    return data, 200, _collection_meta(
        page_unit,
        complete=complete,
        total_count=total,
        received_count=len(all_rows),
        raw_received_count=len(all_rows),
        pages_fetched=pages,
        expected_pages=expected_pages,
        effective_page_unit=effective_page_unit,
        requested_page_unit=requested_page_unit,
        capability_source=capability_source,
        page_error=page_error,
        repeated_page=repeated_page,
        collection_deferred=collection_deferred,
        deferred_reason=deferred_reason,
        elapsed_seconds=time.monotonic() - started_at,
        session_retried=not allow_session_retry,
    ), active


def _direct_search(address, dong, ho, buld_name="", session=None, timeout=20.0):
    """단건용 정확검색. 원본 수신수와 파싱 완전성 메타를 함께 반환한다."""
    active = session or make_session()
    payload = _build_payload(address, dong=dong, ho=ho, buld_name=buld_name,
                             page_index="", page_unit=DIRECT_SEARCH_PAGE_UNIT)
    data, code = _post_search(active, payload, timeout)
    if code in (401, 403):
        active = make_session()
        data, code = _post_search(active, payload, timeout)
    if data is None or code != 200 or (isinstance(data, dict) and "_raw" in data):
        return [], code, active, _collection_meta(DIRECT_SEARCH_PAGE_UNIT)
    candidates, parse_meta = _parse_json_response_with_meta(data)
    total = _total_record_count(data)
    raw_count = parse_meta["raw_record_count"]
    complete = (
        total is not None
        and raw_count == total
        and parse_meta["parse_error_count"] == 0
    )
    meta = _collection_meta(
        DIRECT_SEARCH_PAGE_UNIT,
        complete=complete,
        total_count=total,
        received_count=raw_count,
        raw_received_count=raw_count,
        pages_fetched=1,
        expected_pages=1 if complete else None,
        **parse_meta,
    )
    return candidates, 200, active, meta


def _candidate_content_hash(candidates):
    """후보 순서와 무관한 캐시 내용 해시."""
    normalized = sorted(
        (dict(candidate) for candidate in (candidates or [])),
        key=lambda candidate: (
            str(candidate.get("unique_no") or ""),
            str(candidate.get("dong") or ""),
            str(candidate.get("ho") or ""),
        ),
    )
    payload = json.dumps(
        normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _attach_collection(result, all_candidates, meta, strategy):
    result.all_candidates = all_candidates or []
    result.complete = bool(meta.get("complete"))
    result.total_count = meta.get("total_count")
    result.received_count = int(meta.get("received_count") or 0)
    result.raw_received_count = int(meta.get("raw_received_count") or 0)
    result.parsed_count = int(meta.get("parsed_record_count") or 0)
    result.unique_candidate_count = int(meta.get("unique_candidate_count") or 0)
    result.parse_error_count = int(meta.get("parse_error_count") or 0)
    result.pages_fetched = int(meta.get("pages_fetched") or 0)
    result.expected_pages = meta.get("expected_pages")
    result.effective_page_unit = meta.get("effective_page_unit")
    result.requested_page_unit = meta.get("requested_page_unit")
    result.capability_source = meta.get("capability_source") or "REQUEST"
    result.deferred_reason = meta.get("deferred_reason") or ""
    result.elapsed_seconds = float(meta.get("elapsed_seconds") or 0.0)
    result.schema_fingerprint = meta.get("schema_fingerprint") or ""
    result.query_scope = meta.get("query_scope") or "EXACT_LOT"
    result.strategy = strategy
    result.collector_version = meta.get("collector_version") or COLLECTOR_VERSION
    result.parser_version = PARSER_VERSION
    result.matcher_version = MATCHER_VERSION
    result.content_hash = _candidate_content_hash(result.all_candidates)
    return result


def _building_key(value):
    return re.sub(r"[^0-9A-Za-z가-힣]", "", str(value or "")).lower()


def resolve_one_api(address: str, session: Optional[requests.Session] = None,
                    dong: str = "", ho: str = "", buld_name: str = "",
                    timeout: float = 20.0, strategy: str = "auto",
                    strict: bool = False) -> ResolveResult:
    """단건은 정확검색 우선, 배치(full)는 지번 전체수집 후 로컬 매칭."""
    active = session or make_session()
    pure_lot_addr = _strip_trailing_buldname(address)
    strategy = strategy if strategy in ("auto", "direct", "full") else "auto"

    # 단건 빠른 경로. 정확한 동·호가 모두 있을 때만 시도한다.
    if strategy in ("auto", "direct") and dong and ho:
        direct, code, active, direct_meta = _direct_search(
            address, dong, ho, buld_name=buld_name, session=active, timeout=timeout
        )
        _, want_beonji = _extract_dong_beonji(address)
        direct = [c for c in direct if _match_lot(c, "", want_beonji)] if want_beonji else direct
        direct, class_verified = _filter_expected_property_class(direct, "집합건물")
        direct = [c for c in direct if _match_unit(c, dong, ho)]
        current = [c for c in direct if "폐쇄" not in str(c.get("state", ""))]
        if current:
            direct = current
        if strict and buld_name:
            bk = _building_key(buld_name)
            direct = [c for c in direct
                      if _building_key(c.get("buldnm")) and
                      (bk in _building_key(c.get("buldnm")) or
                       _building_key(c.get("buldnm")) in bk)]
        if direct_meta.get("complete") and class_verified and len(direct) == 1:
            c = direct[0]
            result = ResolveResult(
                address, "RESOLVED", unique_no=c["unique_no"],
                candidates=direct, message="직접검색 정확일치"
            )
            return _attach_collection(result, direct, direct_meta, "DIRECT_SEARCH")
        if strategy == "direct" and direct_meta.get("complete") and direct:
            return _attach_collection(
                ResolveResult(address, "REG_MULTI", candidates=direct,
                              message=f"직접검색 일치후보 {len(direct)}건"),
                direct, direct_meta, "DIRECT_SEARCH",
            )
        # 0건·구분미확인·부분응답은 부재가 아니다. 아래 PNU 전체수집으로 전환한다.

    # PNU/지번 전체수집 경로
    data, code, meta, active = _collect_search(
        pure_lot_addr, session=active, timeout=timeout,
        page_unit=FULL_COLLECT_PAGE_UNIT,
    )
    if code == 503 and meta.get("service_unavailable"):
        return _attach_collection(
            ResolveResult(address, "REG_SERVICE_UNAVAILABLE",
                          message=meta.get("service_message") or "IROS 서비스 이용 불가"),
            [], meta, "FULL_COLLECT",
        )
    if data is None:
        status = "REG_RATE_LIMIT" if code == 429 else (
            "REG_SESSION_ERROR" if code in (401, 403) else "REG_HTTP_ERROR"
        )
        return _attach_collection(
            ResolveResult(address, status, message=f"HTTP {code}"),
            [], meta, "FULL_COLLECT",
        )
    if isinstance(data, dict) and "_raw" in data:
        return _attach_collection(
            ResolveResult(address, "REG_PARSE_ERROR", message="응답 JSON 파싱 실패"),
            [], meta, "FULL_COLLECT",
        )

    cands, parse_meta = _parse_json_response_with_meta(data)
    meta.update(parse_meta)

    # 0건이면 원주소/건물명 검색을 순차 시도한다.
    fallbacks = []
    if not cands and address != pure_lot_addr:
        fallbacks.append((address, ""))
    if not cands and buld_name:
        fallbacks.append((address, buld_name))
        nospace = re.sub(r"\s+", "", buld_name)
        if nospace != buld_name:
            fallbacks.append((address, nospace))
    for query_addr, query_name in fallbacks:
        data2, code2, meta2, active = _collect_search(
            query_addr, buld_name=query_name, session=active,
            timeout=timeout, page_unit=FULL_COLLECT_PAGE_UNIT,
        )
        if data2 and not (isinstance(data2, dict) and "_raw" in data2):
            c2, parse_meta2 = _parse_json_response_with_meta(data2)
            meta2.update(parse_meta2)
        else:
            c2 = []
        if c2:
            cands, meta = c2, meta2
            break

    # 부번 제거 본번 재조회
    widened_to_main = False
    _, orig_beonji = _extract_dong_beonji(address)
    if not cands and orig_beonji and "-" in orig_beonji:
        main_no = orig_beonji.split("-")[0]
        addr_main = _strip_trailing_buldname(address.replace(orig_beonji, main_no, 1))
        data3, code3, meta3, active = _collect_search(
            addr_main, session=active, timeout=timeout,
            page_unit=FULL_COLLECT_PAGE_UNIT,
        )
        if data3 and not (isinstance(data3, dict) and "_raw" in data3):
            c3, parse_meta3 = _parse_json_response_with_meta(data3)
            meta3.update(parse_meta3)
        else:
            c3 = []
        if c3:
            cands, meta = c3, meta3
            meta["query_scope"] = "MAIN_LOT_WIDENED"
            widened_to_main = True

    # 파싱 전량을 캐시용으로 보존하되 지번 필터 후 후보를 실제 매칭에 사용
    all_candidates = list(cands)
    want_dong, want_beonji = _extract_dong_beonji(address)
    if widened_to_main and want_beonji and "-" in want_beonji:
        want_beonji = want_beonji.split("-")[0]
    if want_beonji and cands:
        lot_filtered = [c for c in cands if _match_lot(c, want_dong, want_beonji)]
        if lot_filtered:
            cands = lot_filtered

    # 현행 우선
    current = [c for c in cands if "폐쇄" not in str(c.get("state", ""))]
    if current:
        cands = current

    if meta.get("collection_deferred"):
        return _attach_collection(
            ResolveResult(
                address, "REG_COLLECTION_DEFERRED", candidates=cands,
                message=(f"예상 {meta.get('expected_pages')}페이지로 "
                         "현재 요청의 안전 수집한도를 초과")
            ), all_candidates, meta, "FULL_COLLECT",
        )

    # 전체수집이 증명되지 않으면 부재/단일/다건을 확정하지 않는다.
    if not meta.get("complete"):
        return _attach_collection(
            ResolveResult(
                address, "REG_PARTIAL_RESPONSE", candidates=cands,
                message=(f"부분응답: 총 {meta.get('total_count')}건 중 "
                         f"{meta.get('received_count', 0)}건 수신")
            ), all_candidates, meta, "FULL_COLLECT",
        )

    if meta.get("parse_error_count", 0) > 0:
        return _attach_collection(
            ResolveResult(
                address, "REG_PARSE_INCOMPLETE", candidates=cands,
                message=(f"원본 {meta.get('raw_record_count', 0)}건 중 "
                         f"{meta.get('parsed_record_count', 0)}건 파싱")
            ), all_candidates, meta, "FULL_COLLECT",
        )

    if (dong or ho) and cands:
        cands, class_verified = _filter_expected_property_class(cands, "집합건물")
        if not class_verified:
            return _attach_collection(
                ResolveResult(
                    address, "REG_VALIDATION_FAILED", candidates=all_candidates,
                    message="동·호 입력과 IROS 부동산구분(집합건물) 불일치",
                ), all_candidates, meta, "FULL_COLLECT",
            )

    unit_note = ""
    if (dong or ho) and cands:
        has_unit_info = any(
            str(c.get("dong") or "").strip() or str(c.get("ho") or "").strip()
            for c in cands
        )
        if has_unit_info:
            filtered = [c for c in cands if _match_unit(c, dong, ho)]
            if not filtered and dong and ho:
                any_dong = any(str(c.get("dong") or "").strip() for c in cands)
                any_ho = any(str(c.get("ho") or "").strip() for c in cands)
                if not any_dong and any_ho:
                    filtered = [c for c in cands if _match_unit(c, "", ho)]
                    if filtered:
                        unit_note = "단일 동 건물 — 호로 특정"
            # R-IROS-HO-BUILDING: 후보별 동이 비어 있어도 호와 건물명이
            # 정확히 맞는 후보가 하나면 안전하게 특정한다. 일부 다른 후보에
            # 동 값이 있다는 이유로 기존 전체단위 폴백이 막히던 문제를 보완한다.
            if not filtered and dong and ho and buld_name:
                bk = _building_key(buld_name)
                ho_building = [
                    c for c in cands
                    if _candidate_has_no_dong(c)
                    and _match_unit(c, "", ho)
                    and _building_key(c.get("buldnm")) == bk
                ]
                if len(ho_building) == 1:
                    filtered = ho_building
                    unit_note = "동 미기재 후보 — 호·건물명으로 특정"
            if not filtered:
                want = " ".join(filter(None, [
                    f"{dong}동" if dong else "", f"{ho}호" if ho else ""
                ]))
                return _attach_collection(
                    ResolveResult(
                        address, "REG_UNIT_NOT_FOUND", candidates=cands,
                        message=f"완전 후보 {len(cands)}건에서 {want} 일치 세대 없음",
                    ), all_candidates, meta, "FULL_COLLECT",
                )
            cands = filtered
        else:
            unit_note = "후보에 동·호 정보 없음"

    # R-IROS-BUILDING-DISAMBIG: 호만으로 여러 건이 남으면 정확한 건물명으로
    # 한 건을 고른다. 검토 플래그가 없는 일반 건도 복수결과로 남기지 않는다.
    if len(cands) > 1 and buld_name:
        bk = _building_key(buld_name)
        building_cands = [
            c for c in cands if _building_key(c.get("buldnm")) == bk
        ]
        if len(building_cands) == 1:
            cands = building_cands
            unit_note = f"{unit_note} 건물명으로 특정".strip()

    if strict and buld_name:
        bk = _building_key(buld_name)
        strict_cands = [c for c in cands
                        if _building_key(c.get("buldnm")) and
                        (bk in _building_key(c.get("buldnm")) or
                         _building_key(c.get("buldnm")) in bk)]
        if not strict_cands:
            return _attach_collection(
                ResolveResult(address, "REG_VALIDATION_FAILED", candidates=cands,
                              message="검토대상 건물명 교차검증 실패"),
                all_candidates, meta, "FULL_COLLECT",
            )
        cands = strict_cands

    if not cands:
        return _attach_collection(
            ResolveResult(address, "REG_NOT_FOUND", message="완전수집 결과 없음"),
            all_candidates, meta, "FULL_COLLECT",
        )
    if len(cands) == 1:
        c = cands[0]
        desc = " ".join(filter(None, [
            c.get("gubun", ""), c.get("state", ""),
            f"{c.get('dong')}동" if c.get("dong") else "",
            f"{c.get('ho')}호" if c.get("ho") else "",
            unit_note,
        ]))
        return _attach_collection(
            ResolveResult(address, "RESOLVED", unique_no=c["unique_no"],
                          candidates=cands, message=desc.strip()),
            all_candidates, meta, "FULL_COLLECT",
        )
    return _attach_collection(
        ResolveResult(address, "REG_MULTI", candidates=cands,
                      message=f"{len(cands)}건"),
        all_candidates, meta, "FULL_COLLECT",
    )


def resolve_batch_api(addresses, throttle=1.0, timeout=20.0):
    """일괄 (API 직결). 세션 1회 생성 후 재사용."""
    s = make_session()
    out = []
    n = len(addresses)
    for i, addr in enumerate(addresses):
        r = resolve_one_api(addr, session=s, timeout=timeout)
        out.append(r)
        print(f"[{i+1}/{n}] {addr} -> {r.status}"
              + (f" {r.unique_no}" if r.unique_no else ""), file=sys.stderr)
        if i < n - 1:
            time.sleep(throttle)
    return out


def main():
    ap = argparse.ArgumentParser(description="IROS 고유번호 API 리졸버(순수 requests)")
    ap.add_argument("--addr", help="단일 주소")
    ap.add_argument("--input", help="주소 목록(xlsx A열 또는 txt)")
    ap.add_argument("--out", default="iros-api-결과.xlsx")
    ap.add_argument("--throttle", type=float, default=1.0)
    args = ap.parse_args()

    addresses = []
    if args.addr:
        addresses = [args.addr]
    elif args.input:
        if args.input.lower().endswith((".xlsx", ".xls")):
            import openpyxl
            ws = openpyxl.load_workbook(args.input).active
            for row in ws.iter_rows(values_only=True):
                v = str(row[0] or "").strip() if row else ""
                if v and not re.search(r"주소|address", v, re.I):
                    addresses.append(v)
        else:
            with open(args.input, encoding="utf-8") as f:
                addresses = [ln.strip() for ln in f if ln.strip()]
    else:
        print("--addr 또는 --input 필요", file=sys.stderr)
        sys.exit(1)

    results = resolve_batch_api(addresses, throttle=args.throttle)
    from iros_resolver import write_xlsx
    write_xlsx(results, args.out)
    print(f"\n완료: {args.out} ({len(results)}건)", file=sys.stderr)


if __name__ == "__main__":
    main()


def debug_raw_records(address: str, buld_name: str = "", dong: str = "", ho: str = "",
                      timeout: float = 20.0, page_unit: int = 10) -> dict:
    """진단용: IROS 원본 레코드 + 파서 결과 + '최종 판정'을 함께 반환.

    2026-07-15 개정: 예전엔 동·호를 안 받고 원본 후보만 돌려줘서, 집합건물이면
    무조건 '다건'으로 보였다(실제 앱은 동·호로 1건 특정하는데도). 이제 동·호를
    받아 실제 resolve_one_api를 돌려 최종 판정(RESOLVED/REG_MULTI/REG_UNIT_NOT_FOUND
    등)과 확정된 등기고유번호까지 반환한다 → 진단 결과가 앱의 실제 동작과 일치.
    사용: /api/resolve?addr=...&dong=105&ho=1403&debug=1
    """
    s = make_session()
    pure = _strip_trailing_buldname(address)
    payload = _build_payload(pure, dong="", ho="", buld_name=buld_name, page_unit=page_unit)
    r = s.post(SEARCH_API, json=payload,
               headers={"Content-Type": "application/json; charset=UTF-8"},
               timeout=timeout)
    out = {"swrd": payload["swrd"], "http": r.status_code, "requested_page_unit": page_unit}
    try:
        data = r.json()
    except ValueError:
        out["raw_text_head"] = r.text[:800]
        return out
    out["response_keys"] = list(data.keys()) if isinstance(data, dict) else []
    out["pagination_info"] = data.get("paginationInfo") if isinstance(data, dict) else None
    out["response_preview"] = str(data)[:2000]
    recs = _walk_records(data)
    out["record_count"] = len(recs)
    out["first_records"] = recs[:3]                       # 원본 그대로(키 이름 포함)
    out["parsed_candidates"] = _parse_json_response(data)[:5]   # 파서가 뽑아낸 결과

    # 최종 판정: 실제 조회 로직(부번제거·단일동·동호필터 전부 반영)을 그대로 돌린다.
    try:
        final = resolve_one_api(address, session=s, dong=dong, ho=ho,
                                buld_name=buld_name, timeout=timeout)
        out["final_status"] = final.status
        out["final_unique_no"] = final.unique_no
        out["final_message"] = final.message
        out["final_candidate_count"] = len(final.candidates) if final.candidates else 0
    except Exception as e:
        out["final_status"] = "REG_ERROR"
        out["final_message"] = f"{type(e).__name__}: {e}"
    return out
