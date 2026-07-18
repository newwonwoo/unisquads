# BUILD: 2026-07-18T12:50 rev4 (iros_resolver 의존 제거 · pageUnit 500 · real_cls_cd · 204-1호)
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
  pageUnit     = 10
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
from typing import Optional

try:
    import requests
except ImportError:
    print("의존성 필요: pip install requests", file=sys.stderr)
    raise

# 2026-07-18: iros_resolver 의존을 끊고 필요한 것만 여기에 둔다.
# Vercel 서버리스는 함수별로 파일을 번들하는데 iros_resolver.py가 함께
# 올라가지 않으면 이 import가 실패하고, 모듈이 반쯤 초기화된 채
# sys.modules에 남아 "cannot import name resolve_one_api"가 난다.
# 가져다 쓰던 것은 아래 넷뿐이라 인라인이 안전하다.
from dataclasses import dataclass, field

SIDO_MAP = {
    "서울": "서울특별시", "서울시": "서울특별시", "서울특별시": "서울특별시",
    "부산": "부산광역시", "부산시": "부산광역시", "부산광역시": "부산광역시",
    "대구": "대구광역시", "대구광역시": "대구광역시",
    "인천": "인천광역시", "인천광역시": "인천광역시",
    "광주": "광주광역시", "광주광역시": "광주광역시",
    "대전": "대전광역시", "대전광역시": "대전광역시",
    "울산": "울산광역시", "울산광역시": "울산광역시",
    "세종": "세종특별자치시", "세종시": "세종특별자치시", "세종특별자치시": "세종특별자치시",
    "경기": "경기도", "경기도": "경기도",
    "강원": "강원특별자치도", "강원도": "강원특별자치도", "강원특별자치도": "강원특별자치도",
    "충북": "충청북도", "충청북도": "충청북도",
    "충남": "충청남도", "충청남도": "충청남도",
    "전북": "전북특별자치도", "전라북도": "전북특별자치도", "전북특별자치도": "전북특별자치도",
    "전남": "전라남도", "전라남도": "전라남도",
    "경북": "경상북도", "경상북도": "경상북도",
    "경남": "경상남도", "경상남도": "경상남도",
    "제주": "제주특별자치도", "제주도": "제주특별자치도", "제주특별자치도": "제주특별자치도",
}


@dataclass
class ResolveResult:
    address: str
    status: str
    unique_no: Optional[str] = None
    candidates: list = field(default_factory=list)
    message: str = ""


def normalize_sido(address: str) -> Optional[str]:
    """주소 앞부분에서 시/도를 뽑아 표준 표기로."""
    first = address.strip().split()[0] if address.strip() else ""
    if first in SIDO_MAP:
        return SIDO_MAP[first]
    for key, val in SIDO_MAP.items():
        if address.startswith(key):
            return val
    return None


def strip_sido(address: str, sido_full: Optional[str]) -> str:
    """시/도를 뗀 나머지."""
    if not sido_full:
        return address
    tokens = address.strip().split()
    if tokens and (tokens[0] in SIDO_MAP or tokens[0] == sido_full):
        return " ".join(tokens[1:])
    return address

BASE = "https://www.iros.go.kr"
ENTRY = f"{BASE}/index.jsp"
SEARCH_API = f"{BASE}/biz/Pr20ViaRlrgSrchCtrl/retrieveSmplSrchList.do"

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

    if dong:
        d = re.sub(r"\D", "", str(dong))
        if d:
            parts.append(f"{d}동")
    if ho:
        h = re.sub(r"\D", "", str(ho))
        if h:
            parts.append(f"{h}호")
    return " ".join(parts).strip()


def _build_payload(address: str, dong: str = "", ho: str = "", buld_name: str = "", page_unit: int = 500) -> dict:
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
        "pageIndex": "",
        "pageUnit": page_unit,   # 2026-07-18: 10 → 500. 집합건물은 지번 검색만으로
                                 # 세대 수만큼 다건이 오는데 10건만 받으면 원하는 세대가
                                 # 그 뒤에 있을 때 REG_UNIT_NOT_FOUND가 난다(실측:
                                 # 개포동 653 현대1차 103동 803호 → 204호대 10건만 수신).
                                 # 부족하면 호출부가 1000으로 재조회한다.
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


_UNIT_DONG_RE = re.compile(r"제?(\d+)동")
_UNIT_HO_RE   = re.compile(r"제?(\d+(?:-\d+)?)호")   # 204-1호를 통째로(2026-07-18)


def _extract_unit_from_text(rec: dict):
    """레코드 텍스트(부동산표시 등)에서 동·호를 추출하는 폴백(2026-07-13 추가).

    실측: IROS 응답에서 buld_no_buld/buld_no_room 전용 필드가 비어 오는 경우가
    있고, 동·호는 부동산표시 문장 안에 "제 1 0 1 동 제 1 층 제 103호" 처럼
    (숫자 사이에 공백까지 섞여) 박혀 있다. 공백을 모두 제거한 뒤 '숫자+동',
    '숫자+호'를 뽑는다. '반포동' 같은 법정동은 앞이 숫자가 아니므로 매칭되지
    않고, '제1층'의 층도 대상이 아니라 안전하다.
    """
    blob = " ".join(str(v) for v in rec.values() if isinstance(v, (str, int)))
    blob = _strip_html(blob)
    flat = re.sub(r"\s+", "", blob)          # "제 1 0 1 동" → "제101동"
    d = _UNIT_DONG_RE.search(flat)
    h = _UNIT_HO_RE.search(flat)
    return (d.group(1) if d else ""), (h.group(1) if h else "")


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
    # 호 우선순위(2026-07-18): buld_no_room → buld_no_inner → 텍스트 폴백.
    # 실측 응답에서 buld_no_room은 비고 buld_no_inner에 "204"·"204-1"이 온다.
    ho = str(rec.get("buld_no_room", "") or "") or str(rec.get("buld_no_inner", "") or "")
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
    # 부동산구분(2026-07-18): 원본 real_cls_cd를 그대로 쓴다. pin_mid_spe_yn은
    # 집합건물 표시가 아닌데 그것으로 판정해 토지·건물이 전부 "집합건물"로 나왔다.
    gubun = str(rec.get("real_cls_cd", "") or "").strip()
    if not gubun:
        gubun = "집합건물" if ho else ""
    return {
        "unique_no": uno,
        "gubun": gubun,
        "state": _pick(rec, STATE_KEY_CANDIDATES),
        "sojae": sojae,
        "buldnm": buldnm,
        "dong": dong, "ho": ho, "floor": floor,
        "lot_no": lot_no, "add_item": add_item,
    }


def _total_count(data) -> int:
    """응답의 총건수. paginationInfo.totalRecordCount가 표준이나 구조가
    바뀔 수 있어 흔한 키를 모두 훑는다. 못 찾으면 -1(판정 불가)."""
    if not isinstance(data, dict):
        return -1
    pi = data.get("paginationInfo")
    if isinstance(pi, dict):
        for k in ("totalRecordCount", "totalCount", "totCnt"):
            v = pi.get(k)
            if isinstance(v, (int, str)) and str(v).isdigit():
                return int(v)
    for k in ("totalRecordCount", "totalCount", "totCnt", "totalCnt"):
        v = data.get(k)
        if isinstance(v, (int, str)) and str(v).isdigit():
            return int(v)
    return -1


def _parse_json_response(data) -> list:
    """응답 JSON → 후보 리스트.
    실측 구조: data['dataList'] 배열의 각 레코드에 pin_land(고유번호).
    dataList가 없으면 재귀 탐색 폴백."""
    out, seen = [], set()

    # 1순위: 확정된 dataList 구조
    records = []
    if isinstance(data, dict) and isinstance(data.get("dataList"), list):
        records = data["dataList"]
    else:
        records = _walk_records(data)

    for rec in records:
        if not isinstance(rec, dict):
            continue
        c = _rec_to_cand(rec)
        if c and c["unique_no"] not in seen:
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
    return out


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
    hay = f"{c.get('add_item','')} {c.get('sojae','')} {c.get('lot_no','')}"
    want_main = want_beonji.split("-")[0]
    nums = re.findall(r"\d+", hay)
    if want_dong and want_dong in hay:
        return want_main in nums
    return want_main in nums


def _match_unit(c, dong, ho):
    """레코드가 입력 동·호와 일치하는지. 동·호 없는 레코드(대지권)는 제외.
    숫자'값'으로 비교(문자열 비교 아님) — 등기부 표기가 "0706"처럼 앞자리
    0이 붙어있어도 입력 "706"과 같은 값으로 인식되게 함(2026-07-13 수정:
    래미안 원베일리 116동 706호가 이 패턴으로 매칭 실패했음)."""
    def to_int(s):
        d = re.sub(r"\D", "", str(s or ""))
        return int(d) if d != "" else None

    # 알파벳 동(A동·B동) 대응(2026-07-18): to_int가 "A"를 None으로 만들어
    # 동 조건이 통째로 무시됐다. 그러면 여러 동에 같은 호수가 있을 때
    # 엉뚱한 세대가 매칭된다. 숫자가 없고 영문자만 있으면 문자로 비교한다.
    def to_alpha(s):
        a = re.sub(r"[^A-Za-z]", "", str(s or "")).upper()
        return a if a and not re.search(r"\d", str(s or "")) else ""

    want_alpha = to_alpha(dong)
    if want_alpha:
        cand_alpha = to_alpha(c.get("dong", ""))
        if cand_alpha != want_alpha:
            return False
        want_h = to_int(ho)
        ch = to_int(c.get("ho", ""))
        if want_h is not None and (ch is None or ch != want_h):
            return False
        return True

    cd, ch = to_int(c.get("dong", "")), to_int(c.get("ho", ""))
    want_d, want_h = to_int(dong), to_int(ho)
    if want_d is not None and (cd is None or cd != want_d):
        return False
    if want_h is not None and (ch is None or ch != want_h):
        return False
    return True


def resolve_one_api(address: str, session: Optional[requests.Session] = None,
                    dong: str = "", ho: str = "", buld_name: str = "",
                    timeout: float = 20.0) -> ResolveResult:
    """단일 주소 → 고유번호 (API 직결).

    동/호 처리 방식(2026-07-13 개정): 이전엔 swrd(자연어 검색어)에 "N동 N호"
    텍스트를 얹어 IROS가 1건으로 특정하게 하는 방식이었다(주석엔 "실측"으로
    남아있었음). 그런데 실측으로도 이 조합이 안 걸리는 케이스가 나왔고(예:
    래미안 원베일리 123동 904호 → 0건), 안 걸릴 때마다 건물명 표기만 바꿔
    재시도하느라 왕복이 늘어나 Vercel 함수 제한시간(호비 플랜 기본 5~10초)을
    넘겨 타임아웃까지 유발했다.
    → 그래서 동/호는 검색어(swrd)에 아예 넣지 않는다. 지번+건물명까지만
    검색해 그 건물의 전체 세대 후보를 한 번에 받고(원래 집합건물은 지번만
    검색해도 세대 수만큼 다건으로 정상 반환됨), 아래 _match_unit()
    클라이언트 필터가 동/호로 정확히 좁힌다.

    검색 순서 역전(2026-07-13 추가 개정): "건물명 먼저, 안 되면 지번만"이던
    순서를 "지번만 먼저, 안 되면 건물명 추가"로 뒤집었다. 이유: juso의
    건물명과 등기부(IROS)의 등록명이 다른 경우가 실제로 존재한다 — 예를
    들어 "영등포푸르지오"는 2006년 개명 전 원래 "대우드림타운"으로
    분양·등기됐는데, 등기부는 원래 이름을 그대로 쓰는 경우가 많다. 이런
    건물은 "건물명 먼저" 순서에서 매번 1·2차 시도가 실패하고 3차(건물명
    없음)에서야 성공해 왕복이 항상 3회였다(체감 지연의 주원인). 반대로
    "지번만 먼저"로 하면 이런 건물도 1회 왕복에 바로 성공한다 — 애초에
    집합건물 검색은 지번이 축이고 건물명은 "한 지번에 건물이 여러 채일 때"
    구분하는 보조 수단일 뿐이라, 순서를 뒤집어도 그 보조 역할(안전망)은
    그대로 유지된다.
    """
    s = session or make_session()
    pure_lot_addr = _strip_trailing_buldname(address)  # 주소 자체의 건물명까지 제거

    def _query(bname, addr_override=None, page_unit=500):
        # 동/호는 항상 미포함 — 좁히는 건 뒤쪽 _match_unit()이 전담
        a = address if addr_override is None else addr_override
        payload = _build_payload(a, dong="", ho="", buld_name=bname, page_unit=page_unit)
        # 네트워크 재시도(2026-07-15): IROS가 대량 요청 중 간헐적으로 연결을
        # 끊는다(ConnectionResetError: reset by peer). 재시도 없이 바로 실패로
        # 떨어지면 "거의 못 잡아온다"가 된다. 일시 오류는 짧게 쉬고 최대 3회.
        last_exc = None
        for attempt in range(3):
            try:
                r = s.post(SEARCH_API, json=payload,
                           headers={"Content-Type": "application/json; charset=UTF-8"},
                           timeout=timeout)
                if r.status_code != 200:
                    return None, r.status_code
                try:
                    return r.json(), 200
                except ValueError:
                    return {"_raw": r.text}, 200
            except (requests.ConnectionError, requests.Timeout) as e:
                last_exc = e
                if attempt < 2:
                    time.sleep(0.5 * (attempt + 1))   # 0.5s, 1.0s 백오프
                    continue
                raise
        raise last_exc

    try:
        # 1차: 순수 지번만(주소 자체에 실려온 건물명까지 제거) — 가장 빠르고
        # 안정적인 기본 경로. 동/호도 미포함(위 docstring 참고).
        data, code = _query("", addr_override=pure_lot_addr)
        # 2026-07-18: 받은 건수가 총건수보다 적으면 더 큰 pageUnit으로 한 번 더.
        # 10건만 받던 시절 대단지 세대가 통째로 누락됐다(REG_UNIT_NOT_FOUND).
        _partial = False
        if data is not None:
            _tot = _total_count(data)
            _got = len(_parse_json_response(data))
            if _tot > _got:
                data2, code2 = _query("", addr_override=pure_lot_addr, page_unit=1000)
                if data2 is not None:
                    data, code = data2, code2
                    _tot2 = _total_count(data2)
                    _got2 = len(_parse_json_response(data2))
                    _partial = _tot2 > _got2      # 1000으로도 부족하면 부분응답
                else:
                    _partial = True
        if data is None:
            # HTTP 상태로 원인 구분
            if code == 429:
                return ResolveResult(address, "REG_RATE_LIMIT",
                                     message=f"요청 제한/일시 차단 (HTTP {code})")
            if code in (401, 403):
                return ResolveResult(address, "REG_SESSION_ERROR",
                                     message=f"세션 만료/인증 실패 (HTTP {code})")
            return ResolveResult(address, "REG_HTTP_ERROR",
                                 message=f"HTTP {code} (API 직결 실패)")
        # 응답이 왔으나 파싱 불가(구조 변경 등)
        if isinstance(data, dict) and "_raw" in data:
            return ResolveResult(address, "REG_PARSE_ERROR",
                                 message="응답 구조 변경/파싱 실패 (수동확인)")
        cands = _parse_json_response(data)

        # 순수 지번만으로 0건 → 이름을 붙여 재시도(안전망 — 한 지번에 건물이
        # 여러 채라 지번만으로는 특정이 안 되는 드문 케이스 구제).
        # 순서: ①juso가 원래 실어준 원본 주소 그대로(건물명이 자연스레
        # 포함돼 있음) → ②명시적으로 받은 buld_name → ③그 붙여쓰기.
        # ①②③은 addr_override 없이(=원본 address 기준) 호출해야 건물명이
        # 실제로 검색어에 실린다.
        if len(cands) == 0:
            fallback_bnames = []
            if address != pure_lot_addr:
                fallback_bnames.append("")  # 원본 address 자체에 건물명이 실려있음
            if buld_name:
                fallback_bnames.append(buld_name)
                nospace = re.sub(r"\s+", "", buld_name)
                if nospace != buld_name:
                    fallback_bnames.append(nospace)  # 붙여쓰기
            for v in fallback_bnames:
                data, code = _query(v)  # addr_override 없음 → 원본 address 사용
                if data is None or (isinstance(data, dict) and "_raw" in data):
                    continue
                cands = _parse_json_response(data)
                if cands:
                    break

        # 부번 제거 재시도(2026-07-15): IROS 등기부는 부번 없는 '대표지번'에
        # 집합건물을 통째로 올려두는 경우가 있다(실측: 부산 기장 만화리 271-8은
        # 0건, 271은 1건 — 등기 지번이 부번 없는 271). 지번(본번-부번)으로 0건이면
        # 부번을 떼고 본번만으로 한 번 더 검색한다. 단 이렇게 넓히면 같은 본번의
        # 다른 부번 건물이 섞일 수 있으므로, 아래 _match_lot은 '원래 부번'이 아니라
        # 본번 기준으로 비교하도록 want_beonji를 본번으로 완화한다(과탈락 방지).
        widened_to_main = False
        if len(cands) == 0:
            _, orig_beonji = _extract_dong_beonji(address)
            if orig_beonji and "-" in orig_beonji:
                main_no = orig_beonji.split("-")[0]
                addr_main = address.replace(orig_beonji, main_no, 1)
                pure_main = _strip_trailing_buldname(addr_main)
                data, code = _query("", addr_override=pure_main)
                if data is not None and not (isinstance(data, dict) and "_raw" in data):
                    c2 = _parse_json_response(data)
                    if c2:
                        cands = c2
                        widened_to_main = True
                # 부번 뗀 뒤에도 0건이면 건물명까지 붙여 마지막 시도
                if len(cands) == 0 and buld_name:
                    data, code = _query(buld_name, addr_override=pure_main)
                    if data is not None and not (isinstance(data, dict) and "_raw" in data):
                        c3 = _parse_json_response(data)
                        if c3:
                            cands = c3
                            widened_to_main = True

        # 지번(번지) 필터: 건물명 검색으로 다른 번지 건물이 섞여오면 정제 지번으로 걸러냄
        want_dong, want_beonji = _extract_dong_beonji(address)
        if widened_to_main and want_beonji and "-" in want_beonji:
            want_beonji = want_beonji.split("-")[0]   # 본번으로 넓혀 검색했으니 필터도 본번 기준
        if want_beonji and cands:
            lot_filtered = [c for c in cands if _match_lot(c, want_dong, want_beonji)]
            if lot_filtered:
                cands = lot_filtered

        # 동·호 정확 매칭 필터 (대지권·다른동 제외)
        # 2026-07-13 수정: 예전엔 `if filtered: cands = filtered` 였는데, 이러면
        # 매칭이 0건일 때 필터 결과를 버리고 '필터 전 후보 전체'를 그대로 되살려
        # REG_MULTI(다건)로 내보냈다 → 사용자가 동·호를 정확히 찍었는데도 그 단지의
        # 모든 세대가 후보로 뜨는 원인(1차 원인인 선행0 매칭실패와 연쇄).
        # 이제 매칭 0건이면 후보를 되살리지 않고 명확히 실패로 끝낸다.
        # 단, 후보 중 '동·호 정보를 가진 레코드가 하나도 없는' 경우는 매칭 실패가
        # 아니라 '필터 불가'(토지 등기만 있거나 IROS 응답 키 변경 등)이므로,
        # 이때는 잘못된 단정을 피하기 위해 후보를 유지하고 사유를 표시한다.
        unit_filter_note = ""
        if (dong or ho) and cands:
            has_unit_info = any(
                str(c.get("dong") or "").strip() or str(c.get("ho") or "").strip()
                for c in cands
            )
            if has_unit_info:
                filtered = [c for c in cands if _match_unit(c, dong, ho)]
                # 단일 동 건물 구제(2026-07-15): 등기부는 동이 하나뿐인 건물에
                # 동 표기를 안 하는 경우가 많다(예: 문화파크맨션). 이때 사용자
                # 입력의 "1동"이 후보(동 없음)와 안 맞아 전멸한다. 후보 전체가
                # '동은 비었고 호는 있는' 상태면, 동을 무시하고 호로만 재매칭한다.
                if not filtered and dong and ho:
                    any_dong = any(str(c.get("dong") or "").strip() for c in cands)
                    any_ho = any(str(c.get("ho") or "").strip() for c in cands)
                    if not any_dong and any_ho:
                        filtered = [c for c in cands if _match_unit(c, "", ho)]
                        if filtered:
                            unit_filter_note = " (단일 동 건물 — 동 표기 없이 호로 특정)"
                if not filtered:
                    want = " ".join(filter(None, [f"{dong}동" if dong else "",
                                                  f"{ho}호" if ho else ""]))
                    # 전체를 못 받은 상태면 "세대 없음"으로 확정하지 않는다(2026-07-18).
                    # 앞부분만 보고 미존재로 단정하면 오실패가 된다.
                    if _partial:
                        return ResolveResult(
                            address, "REG_PARTIAL_RESPONSE",
                            candidates=cands,
                            message=f"응답이 일부만 수신되어 {want} 존재 여부를 확정할 수 없습니다 "
                                    f"(수신 {len(cands)}건). 재조회가 필요합니다.")
                    return ResolveResult(
                        address, "REG_UNIT_NOT_FOUND",
                        candidates=cands,
                        message=f"해당 지번의 등기는 찾았으나 {want}와 일치하는 세대가 없습니다 "
                                f"(후보 {len(cands)}건). 동·호를 확인해 주세요.")
                cands = filtered
            else:
                unit_filter_note = " (응답에 동·호 정보가 없어 세대 필터 미적용)"

        if len(cands) == 0:
            return ResolveResult(address, "REG_NOT_FOUND",
                                 message="검색결과 없음. 주소 정밀도/미등록 확인.")
        if len(cands) == 1:
            c = cands[0]
            desc = " ".join(filter(None, [c.get("gubun", ""), c.get("state", ""),
                                          (c.get("dong") and f"{c['dong']}동") or "",
                                          (c.get("ho") and f"{c['ho']}호") or ""]))
            return ResolveResult(address, "RESOLVED", unique_no=c["unique_no"],
                                 candidates=cands, message=desc.strip())
        note = unit_filter_note   # 위 필터에서 '동·호 정보 없어 필터 불가'였던 경우만 채워짐
        return ResolveResult(address, "REG_MULTI", candidates=cands,
                             message=f"{len(cands)}건{note}")
    except requests.Timeout:
        return ResolveResult(address, "REG_TIMEOUT", message="시간초과(API 직결)")
    except Exception as e:
        return ResolveResult(address, "REG_ERROR", message=f"{type(e).__name__}: {e}")


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
                      timeout: float = 20.0) -> dict:
    """진단용: IROS 원본 레코드 + 파서 결과 + '최종 판정'을 함께 반환.

    2026-07-15 개정: 예전엔 동·호를 안 받고 원본 후보만 돌려줘서, 집합건물이면
    무조건 '다건'으로 보였다(실제 앱은 동·호로 1건 특정하는데도). 이제 동·호를
    받아 실제 resolve_one_api를 돌려 최종 판정(RESOLVED/REG_MULTI/REG_UNIT_NOT_FOUND
    등)과 확정된 등기고유번호까지 반환한다 → 진단 결과가 앱의 실제 동작과 일치.
    사용: /api/resolve?addr=...&dong=105&ho=1403&debug=1
    """
    s = make_session()
    pure = _strip_trailing_buldname(address)
    payload = _build_payload(pure, dong="", ho="", buld_name=buld_name)
    r = s.post(SEARCH_API, json=payload,
               headers={"Content-Type": "application/json; charset=UTF-8"},
               timeout=timeout)
    out = {"swrd": payload["swrd"], "http": r.status_code}
    try:
        data = r.json()
    except ValueError:
        out["raw_text_head"] = r.text[:800]
        return out
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
