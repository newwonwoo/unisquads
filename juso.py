"""
Vercel 서버리스: 카카오 로컬 프록시
GET /api/kakao?type=keyword&query=래미안원베일리
GET /api/kakao?type=coord2region&x=127.0&y=37.5
→ 카카오 응답의 documents 배열

키를 서버 환경변수(KAKAO_REST_KEY)에 두어 노출 방지.
"""
import os
import json
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

KAKAO_KEY = os.environ.get("KAKAO_REST_KEY", "")
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
COORD_URL = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json"


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
        if not KAKAO_KEY:
            return self._send(500, {"error": "KAKAO_REST_KEY 미설정(Vercel 환경변수)"})
        qs = parse_qs(urlparse(self.path).query)
        typ = (qs.get("type", ["keyword"])[0])
        try:
            if typ == "coord2region":
                x = qs.get("x", [""])[0]
                y = qs.get("y", [""])[0]
                url = f"{COORD_URL}?{urllib.parse.urlencode({'x': x, 'y': y})}"
            else:
                query = qs.get("query", [""])[0]
                url = f"{KEYWORD_URL}?{urllib.parse.urlencode({'query': query})}"
            req = urllib.request.Request(url, headers={"Authorization": f"KakaoAK {KAKAO_KEY}"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            self._send(200, {"documents": data.get("documents", [])})
        except Exception as e:
            self._send(200, {"error": f"{type(e).__name__}: {e}", "documents": []})
