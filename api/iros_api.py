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

# iros_resolver의 시/도 매핑·정규화·데이터클래스 재사용 (중복 방지)
from iros_resolver import (
    ResolveResult, normalize_sido, strip_sido,
)

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


def _build_payload(address: str, dong: str = "", ho: str = "", buld_name: str = "") -> dict:
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
        "pageUnit": 10,          # 사람과 동일하게 10건씩 (100은 자동화로 티남)
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
    ho = str(rec.get("buld_no_room", "") or "")
    floor = str(rec.get("buld_no_floor", "") or "")
    # 지번 정보 (번지 필터용): lot_no=본번, addItem="법정동 번지"
    lot_no = str(rec.get("lot_no", "") or "")
    add_item = _strip_html(str(rec.get("addItem", "") or ""))
    # 집합건물이면 부동산구분을 "집합건물", 아니면 빈값(토지/건물은 목록에 따로)
    gubun = "집합건물" if rec.get("pin_mid_spe_yn") == "Y" or ho else ""
    return {
        "unique_no": uno,
        "gubun": gubun,
        "state": _pick(rec, STATE_KEY_CANDIDATES),
        "sojae": sojae,
        "buldnm": buldnm,
        "dong": dong, "ho": ho, "floor": floor,
        "lot_no": lot_no, "add_item": add_item,
    }


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

    def _query(bname, addr_override=None):
        # 동/호는 항상 미포함 — 좁히는 건 뒤쪽 _match_unit()이 전담
        a = address if addr_override is None else addr_override
        payload = _build_payload(a, dong="", ho="", buld_name=bname)
        r = s.post(SEARCH_API, json=payload,
                   headers={"Content-Type": "application/json; charset=UTF-8"},
                   timeout=timeout)
        if r.status_code != 200:
            return None, r.status_code
        try:
            return r.json(), 200
        except ValueError:
            return {"_raw": r.text}, 200

    try:
        # 1차: 순수 지번만(주소 자체에 실려온 건물명까지 제거) — 가장 빠르고
        # 안정적인 기본 경로. 동/호도 미포함(위 docstring 참고).
        data, code = _query("", addr_override=pure_lot_addr)
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

        # 지번(번지) 필터: 건물명 검색으로 다른 번지 건물이 섞여오면 정제 지번으로 걸러냄
        want_dong, want_beonji = _extract_dong_beonji(address)
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
                if not filtered:
                    want = " ".join(filter(None, [f"{dong}동" if dong else "",
                                                  f"{ho}호" if ho else ""]))
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
