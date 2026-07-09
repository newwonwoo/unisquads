"""
Vercel 서버리스: juso.go.kr 주소검색 프록시
GET /api/juso?keyword=강남 테헤란로 212
→ juso API 원응답의 results.juso 배열

키를 서버 환경변수(JUSO_CONFM_KEY)에 두어 브라우저에 노출하지 않음.
CORS도 여기서 해결(브라우저가 juso를 직접 못 부르는 문제 우회).
"""
import os
import json
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

JUSO_KEY = os.environ.get("JUSO_CONFM_KEY", "")
JUSO_URL = "https://business.juso.go.kr/addrlink/addrLinkApi.do"


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        if not JUSO_KEY:
            return self._send(500, {"error": "JUSO_CONFM_KEY 미설정(Vercel 환경변수)"})
        qs = parse_qs(urlparse(self.path).query)
        keyword = (qs.get("keyword", [""])[0]).strip()
        if not keyword:
            return self._send(400, {"error": "keyword 필요"})
        params = urllib.parse.urlencode({
            "confmKey": JUSO_KEY, "currentPage": "1", "countPerPage": "10",
            "resultType": "json", "keyword": keyword,
        })
        try:
            with urllib.request.urlopen(f"{JUSO_URL}?{params}", timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            self._send(200, data.get("results", {}))
        except Exception as e:
            self._send(200, {"error": f"{type(e).__name__}: {e}", "juso": []})
