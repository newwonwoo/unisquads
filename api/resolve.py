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

try:
    from iros_api import resolve_one_api
    _ERR = None
except Exception as e:  # import 실패 원인을 응답에 노출(디버깅용)
    resolve_one_api = None
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
        if not addr:
            return self._send(400, {"status": "ERROR", "message": "addr 파라미터 필요"})
        try:
            r = resolve_one_api(addr, dong=dong, ho=ho, buld_name=bdnm)
            self._send(200, {
                "address": r.address, "status": r.status, "unique_no": r.unique_no,
                "candidates": r.candidates, "message": r.message,
            })
        except Exception as e:
            self._send(200, {"status": "ERROR", "message": f"{type(e).__name__}: {e}"})
