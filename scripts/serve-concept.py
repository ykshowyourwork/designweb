"""Preview a hand-built sample site without a full build:
    python3 scripts/serve-concept.py <port>
then open http://localhost:<port>/concepts/<slug>/index.html
Paths under /samples/ and /demo/ are served from public/, like the live site."""
import http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p.startswith(("/samples/", "/demo/", "/work/")):
            return os.path.join(ROOT, "public", p.lstrip("/"))
        return os.path.join(ROOT, p.lstrip("/"))
    def log_message(self, *a):
        pass

http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
