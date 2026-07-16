"""
Vercel 서버리스: 네이버 지역검색 프록시
GET /api/naver?query=혜창한마음비치
→ {ok: true, items: [{title, address, roadAddress, mapx, mapy, category}]}

키를 서버 환경변수(NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)에 두어 노출 방지.

★ 핵심(보완사항 1): API 장애와 '결과 0건'을 명확히 구분해서 반환한다.
  - HTTP 200 + items 0건  → {ok: true,  items: []}       → 프론트: HUMAN_INPUT_ERROR
  - 인증/한도/타임아웃/5xx → {ok: false, error_kind: ...} → 프론트: SYSTEM_ERROR(재시도)
장애를 인적 오류로 오분류하지 않기 위함.
"""
import os
import re
import json
import socket
import urllib.request
import urllib.parse
import urllib.error
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

NAVER_ID = os.environ.get("NAVER_CLIENT_ID", "")
NAVER_SECRET = os.environ.get("NAVER_CLIENT_SECRET", "")
# NAVER API HUB 기준 엔드포인트(검색 API 이관). 지역검색 경로는 동일 유지.
LOCAL_URL = "https://openapi.naver.com/v1/search/local.json"

_TAG_RE = re.compile(r"<[^>]+>")


def _strip(s):
    return _TAG_RE.sub("", s or "").strip()


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
        # 인증정보 미설정 = 시스템 오류(인적 오류 아님)
        if not NAVER_ID or not NAVER_SECRET:
            return self._send(200, {"ok": False, "error_kind": "AUTH",
                                    "error": "NAVER_CLIENT_ID/SECRET 미설정(Vercel 환경변수)"})
        qs = parse_qs(urlparse(self.path).query)
        query = (qs.get("query", [""])[0]).strip()
        if not query:
            return self._send(400, {"ok": False, "error_kind": "BAD_REQUEST",
                                    "error": "query 파라미터 필요"})
        display = qs.get("display", ["5"])[0]
        sort = qs.get("sort", ["random"])[0]   # random=정확도순

        url = f"{LOCAL_URL}?{urllib.parse.urlencode({'query': query, 'display': display, 'sort': sort})}"
        req = urllib.request.Request(url)
        req.add_header("X-Naver-Client-Id", NAVER_ID)
        req.add_header("X-Naver-Client-Secret", NAVER_SECRET)

        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.loads(r.read().decode("utf-8"))
            items = []
            for it in data.get("items", []):
                items.append({
                    "title": _strip(it.get("title")),
                    "category": it.get("category", ""),
                    "address": it.get("address", ""),          # 지번주소
                    "roadAddress": it.get("roadAddress", ""),   # 도로명주소
                    "mapx": it.get("mapx", ""),
                    "mapy": it.get("mapy", ""),
                })
            # HTTP 200 + 결과(0건 포함) → 정상 응답. 0건이면 프론트가 HUMAN_INPUT_ERROR 판정
            return self._send(200, {"ok": True, "items": items, "total": data.get("total", 0)})

        except urllib.error.HTTPError as e:
            # 4xx/5xx: 한도초과(429)·인증(401/403)·서버(5xx) 전부 시스템 오류
            kind = "RATE_LIMIT" if e.code == 429 else ("AUTH" if e.code in (401, 403) else "HTTP")
            return self._send(200, {"ok": False, "error_kind": kind,
                                    "error": f"HTTP {e.code}", "http": e.code})
        except (socket.timeout, urllib.error.URLError) as e:
            return self._send(200, {"ok": False, "error_kind": "TIMEOUT",
                                    "error": f"{type(e).__name__}: {e}"})
        except Exception as e:
            return self._send(200, {"ok": False, "error_kind": "UNKNOWN",
                                    "error": f"{type(e).__name__}: {e}"})
