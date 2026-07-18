# BUILD: 2026-07-18T12:55 rev5 (import 실패 원인 노출)
"""
Vercel 서버리스: 등기고유번호 조회
GET /api/resolve?addr=서초구 서초동 967
→ {status, unique_no, candidates, message}

iros_api.py(requests 기반)를 사용. Playwright 불필요 → 서버리스 호환.
"""
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import os
import sys
sys.path.append(os.path.dirname(__file__))

# 2026-07-18: import 실패의 '진짜 원인'을 드러낸다. 모듈이 반쯤 초기화된 채
# sys.modules에 남으면 이후 시도는 "cannot import name ..."만 보여주고 첫
# 실패 원인(예: 하위 import 누락)이 가려진다. 캐시를 지우고 다시 읽는다.
import traceback as _tb

_ERR = None
resolve_one_api = None
debug_raw_records = None
try:
    for _m in ("iros_api", "iros_resolver"):
        sys.modules.pop(_m, None)          # 부분 초기화 잔재 제거
    import iros_api as _ia
    resolve_one_api = getattr(_ia, "resolve_one_api", None)
    debug_raw_records = getattr(_ia, "debug_raw_records", None)
    if resolve_one_api is None:
        _names = [n for n in dir(_ia) if not n.startswith("_")]
        _ERR = ("iros_api는 로드됐으나 resolve_one_api가 없음. "
                f"파일={getattr(_ia, '__file__', '?')} "
                f"BUILD={(open(_ia.__file__, encoding='utf-8').readline().strip() if getattr(_ia, '__file__', None) else '?')} "
                f"보유심볼={_names[:25]}")
except Exception as e:
    _ERR = f"{type(e).__name__}: {e}\n{_tb.format_exc()[-900:]}"


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        if resolve_one_api is None:
            return self._send(500, {"status": "ERROR",
                                    "message": f"resolver import 실패: {_ERR}"})
        qs = parse_qs(urlparse(self.path).query)
        addr = (qs.get("addr", [""])[0]).strip()
        dong = (qs.get("dong", [""])[0]).strip()
        ho = (qs.get("ho", [""])[0]).strip()
        bdnm = (qs.get("bdnm", [""])[0]).strip()
        if not addr:
            return self._send(400, {"status": "ERROR", "message": "addr 파라미터 필요"})
        # 진단 모드: IROS 원본 레코드를 그대로 반환 — 파서가 어떤 필드를 보고
        # 있는지 '추측 없이' 확인하기 위한 용도. (예: /api/resolve?addr=...&debug=1)
        if qs.get("debug", [""])[0] == "1":
            # 진단 모드(2026-07-15 rev3): 별도 debug_raw_records 함수에 의존하지
            # 않고 resolve_one_api를 '직접' 호출한다. Vercel 빌드 캐시로 옛
            # iros_api가 번들되면 debug_raw_records 시그니처가 어긋나 TypeError가
            # 났는데(dong 인자), resolve_one_api는 처음부터 dong/ho를 받아온
            # 함수라 이 문제에서 자유롭다. 원본 IROS 응답이 더 필요하면 아래
            # debug_raw_records도 '있으면' 부가로 시도한다(없어도 무방).
            try:
                r = resolve_one_api(addr, dong=dong, ho=ho, buld_name=bdnm)
                out = {
                    "final_status": r.status,
                    "final_unique_no": r.unique_no,
                    "final_message": r.message,
                    "final_candidate_count": len(r.candidates) if r.candidates else 0,
                    # 진단 표에서 쓰는 필드: 후보 목록(동·호·지번 포함)
                    "parsed_candidates": (r.candidates or [])[:5],
                    "record_count": len(r.candidates) if r.candidates else 0,
                }
                # swrd(실제 검색어)는 debug_raw_records가 있을 때만 부가 제공
                if debug_raw_records:
                    try:
                        import inspect as _inspect
                        _p = _inspect.signature(debug_raw_records).parameters
                        _kw = {"buld_name": bdnm}
                        if "dong" in _p: _kw["dong"] = dong
                        if "ho" in _p: _kw["ho"] = ho
                        raw = debug_raw_records(addr, **_kw)
                        out["swrd"] = raw.get("swrd", "")
                        out["first_records"] = raw.get("first_records", [])
                    except Exception:
                        out["swrd"] = ""   # 부가정보 실패는 무시(핵심 판정은 위에서 끝)
                return self._send(200, out)
            except Exception as e:
                return self._send(200, {"status": "ERROR",
                                        "message": f"{type(e).__name__}: {e}"})
        try:
            r = resolve_one_api(addr, dong=dong, ho=ho, buld_name=bdnm)
            self._send(200, {
                "address": r.address, "status": r.status, "unique_no": r.unique_no,
                "candidates": r.candidates, "message": r.message,
            })
        except Exception as e:
            self._send(200, {"status": "ERROR", "message": f"{type(e).__name__}: {e}"})
