# BUILD: 2026-07-15T04:45 rev3 (debug=resolve_one_api 직접호출, 캐시무관)
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
sys.path.insert(0, os.path.dirname(__file__))

try:
    from iros_api import resolve_one_api, debug_raw_records
    _ERR = None
except Exception as e:  # import 실패 원인을 응답에 노출(디버깅용)
    resolve_one_api = None
    debug_raw_records = None
    _ERR = f"{type(e).__name__}: {e}"


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
        strategy = (qs.get("strategy", ["auto"])[0]).strip()
        strict = (qs.get("strict", ["0"])[0]).strip() == "1"
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
                r = resolve_one_api(addr, dong=dong, ho=ho, buld_name=bdnm, strategy=strategy, strict=strict)
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
                        out["response_keys"] = raw.get("response_keys", [])
                        out["pagination_info"] = raw.get("pagination_info")
                        out["response_preview"] = raw.get("response_preview", "")
                    except Exception:
                        out["swrd"] = ""   # 부가정보 실패는 무시(핵심 판정은 위에서 끝)
                return self._send(200, out)
            except Exception as e:
                return self._send(200, {"status": "ERROR",
                                        "message": f"{type(e).__name__}: {e}"})
        try:
            r = resolve_one_api(addr, dong=dong, ho=ho, buld_name=bdnm, strategy=strategy, strict=strict)
            self._send(200, {
                "address": r.address, "status": r.status, "unique_no": r.unique_no,
                "candidates": r.candidates, "message": r.message,
                "all_candidates": r.all_candidates,
                "complete": r.complete,
                "total_count": r.total_count,
                "received_count": r.received_count,
                "pages_fetched": r.pages_fetched,
                "strategy": r.strategy,
                "parser_version": r.parser_version,
            })
        except Exception as e:
            self._send(200, {"status": "ERROR", "message": f"{type(e).__name__}: {e}"})
