# BUILD: 2026-07-18T13:20 (배포 진단 전용)
"""
배포 진단: GET /api/ping
- 이 파일이 응답하면 배포 자체는 되고 있다는 뜻
- /var/task 에 실제로 어떤 파일이 있는지, iros_api.py의 BUILD 주석이 무엇인지 보여준다
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        here = os.path.dirname(__file__)
        out = {
            "ping": "ok",
            "build": "2026-07-18T13:20",
            "cwd": os.getcwd(),
            "here": here,
        }

        # 같은 폴더에 뭐가 있는지
        try:
            out["files"] = sorted(os.listdir(here))
        except Exception as e:
            out["files_error"] = str(e)

        # iros_api.py 의 첫 줄(BUILD 주석)과 크기
        p = os.path.join(here, "iros_api.py")
        try:
            st = os.stat(p)
            with open(p, encoding="utf-8") as f:
                first = f.readline().strip()
            out["iros_api"] = {"exists": True, "size": st.st_size, "first_line": first}
        except Exception as e:
            out["iros_api"] = {"exists": False, "error": str(e)}

        # resolve.py 첫 줄
        p2 = os.path.join(here, "resolve.py")
        try:
            with open(p2, encoding="utf-8") as f:
                out["resolve_first_line"] = f.readline().strip()
        except Exception as e:
            out["resolve_first_line"] = f"error: {e}"

        # 실제 import 시도 — 실패하면 traceback 전문
        sys.path.append(here)
        try:
            import traceback
            for m in ("iros_api", "iros_resolver"):
                sys.modules.pop(m, None)
            import iros_api as ia
            out["import"] = {
                "ok": True,
                "file": getattr(ia, "__file__", "?"),
                "has_resolve_one_api": hasattr(ia, "resolve_one_api"),
                "symbols": [n for n in dir(ia) if not n.startswith("_")][:30],
            }
        except Exception as e:
            import traceback
            out["import"] = {
                "ok": False,
                "error": f"{type(e).__name__}: {e}",
                "traceback": traceback.format_exc()[-1500:],
            }

        body = json.dumps(out, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
