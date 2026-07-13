"""
api/units.py — PNU로 그 단지의 동·호 목록 조회 (VWorld 공동주택가격 API)

동·호 판(UnitPicker)의 데이터 소스. ltvcheck gongsiga.py 방식 이식.
PNU만 넣고 numOfRows=1000으로 호출 → 그 단지 전체 세대(동·호) 목록 수신.
juso 상세주소 API 불필요 — VWorld 하나로 동·호 목록 확보.

호출:
  GET /api/units?pnu=1156010100106470000
  → {"ok":true, "count":N, "hasDong":true, "units":[{"dong":"106","ho":"802"}...],
     "name":"영등포푸르지오"}

환경변수: VWORLD_API_KEY (필수), VWORLD_DOMAIN (선택)
"""

import os
import json
import re
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

VWORLD_NED_URL = "https://api.vworld.kr/ned/data/getApartHousingPriceAttr"
_KEY_ERRORS = {"INVALID_KEY", "INCORRECT_KEY", "UNAVAILABLE_KEY", "OVER_REQUEST_LIMIT"}


def _env(name, default=None):
    v = os.environ.get(name, "").strip()
    return v or default


def _http_get(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": "addr-refine/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        # VWorld는 에러도 본문에 이유를 담아 보냄 → 읽어서 원인 노출
        try:
            body = e.read().decode("utf-8", "ignore")[:300]
        except Exception:
            body = ""
        raise RuntimeError(f"HTTP {e.code} — {body or e.reason}") from None


def _build_url(pnu, *, key, domain=None, num_rows=1000, page=1):
    params = {"pnu": pnu, "format": "json", "numOfRows": num_rows,
              "pageNo": page, "key": key}
    if domain:
        params["domain"] = domain
    return f"{VWORLD_NED_URL}?{urllib.parse.urlencode(params)}"


def _parse_json(raw):
    """VWorld JSON 응답 → (fields_list, total, error_code).
    정상: {"apartHousingPrices":{"totalCount":..,"fields":{"field":[...]}}}
    에러: {"apartHousingPrices":{"resultCode":"INCORRECT_KEY",...}}"""
    data = json.loads(raw)
    root = data.get("apartHousingPrices") or data.get("response") or data
    rc = root.get("resultCode")
    if rc:
        return [], 0, rc
    total = int(root.get("totalCount", 0) or 0)
    fields = root.get("fields") or root.get("field") or []
    if isinstance(fields, dict):
        fields = fields.get("field", fields)
    if isinstance(fields, dict):
        fields = [fields]
    if not isinstance(fields, list):
        fields = [fields] if fields else []
    return fields, total, None


def _unit_list(fields):
    """VWorld 세대 목록 → [{"dong","ho"}] 정리 (중복제거, 숫자정렬).
    동 정보 비어있으면 dong=""(호만 목록). 단지명·주택유형도 추출."""
    seen, out = set(), []
    name = None
    apt_type = None  # 아파트/연립/다세대 (aphusSeCodeNm)
    for f in fields:
        d = (f.get("dongNm") or "").strip()
        h = (f.get("hoNm") or "").strip()
        if name is None and f.get("aphusNm"):
            name = f.get("aphusNm")
        if apt_type is None and f.get("aphusSeCodeNm"):
            apt_type = f.get("aphusSeCodeNm")
        key = (d, h)
        if key in seen or (not d and not h):
            continue
        seen.add(key)
        out.append({"dong": d, "ho": h})

    def num(s):
        m = re.findall(r"\d+", s)
        return (0, int(m[0])) if m else (1, s)

    out.sort(key=lambda x: (num(x["dong"]), num(x["ho"])))
    return out, name, apt_type


def _fetch_units(pnu):
    key = _env("VWORLD_API_KEY")
    domain = _env("VWORLD_DOMAIN")
    if not key:
        return {"ok": False, "error": "VWORLD_API_KEY 미설정",
                "hint": "Vercel 환경변수에 VWorld 인증키를 넣으세요."}

    # totalCount 기반 페이징: 첫 응답의 전체 세대수를 보고 부족하면 다음 페이지 추가 수신
    # (1000세대 초과 대단지 누락 방지 — 딱 세대수만큼만 가져옴)
    all_fields = []
    total = 0
    page = 1
    NUM = 1000
    MAX_PAGES = 10
    prev_len = -1
    # domain 유무 조합 자동 시도 (VWorld 키 등록 방식에 따라 요구가 다름)
    domain_opts = [domain, None] if domain else [None, ""]
    last_err = None
    while page <= MAX_PAGES:
        raw = None
        for dom in domain_opts:
            url = _build_url(pnu, key=key, domain=dom, num_rows=NUM, page=page)
            try:
                raw = _http_get(url)
                domain_opts = [dom]  # 성공한 조합으로 고정
                last_err = None
                break
            except Exception as e:
                last_err = e
                continue
        if raw is None:
            if all_fields:
                break  # 일부라도 받았으면 그걸로 진행
            return {"ok": False,
                    "error": f"VWorld 호출 실패: {last_err}",
                    "hint": "키가 맞는지, vworld.kr에 등록한 서비스 URL이 배포 주소와 같은지 확인하세요. "
                            "필요시 Vercel 환경변수 VWORLD_DOMAIN에 등록 URL을 넣어주세요."}
        fields, total, err = _parse_json(raw)
        if err:
            if all_fields:
                break
            msg = "키 인증 실패" if err in _KEY_ERRORS else f"VWorld 오류: {err}"
            return {"ok": False, "error": msg, "code": err}
        all_fields.extend(fields)
        # 종료 조건: 전체 세대수 다 받음 / 빈 페이지 / 진전 없음
        if total and len(all_fields) >= total:
            break
        if len(fields) == 0:
            break
        if len(all_fields) == prev_len:  # 같은 결과 반복 → 중단
            break
        prev_len = len(all_fields)
        if len(fields) < NUM:  # 받은 게 요청보다 적으면 마지막 페이지
            break
        page += 1

    units, name, apt_type = _unit_list(all_fields)
    has_dong = any(u["dong"] for u in units)
    return {
        "ok": True, "pnu": pnu, "count": len(units), "total": total or len(all_fields),
        "pages": page, "hasDong": has_dong, "units": units, "name": name, "aptType": apt_type,
        "single": len(units) == 1,
    }


class handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            pnu = (qs.get("pnu") or [""])[0].strip()
            if not pnu:
                return self._send(400, {"ok": False, "error": "pnu 파라미터 필요"})
            self._send(200, _fetch_units(pnu))
        except Exception as e:
            self._send(200, {"ok": False, "error": f"{type(e).__name__}: {e}"})
