#!/usr/bin/env python3
"""سرور توسعهٔ بدون کش برای پوشهٔ پروژه، فقط روی 127.0.0.1.
PUT /__shot/<name>.png  ←  عکس در /tmp/scan-work/shots/<name>.png ذخیره می‌شود (برای __view و __shot).
اجرا: python3 .claude/skills/new-product/scripts/devserver.py [port=8794]"""
import http.server, functools, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
OUT = '/tmp/scan-work/shots'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8794
os.makedirs(OUT, exist_ok=True)

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_PUT(self):
        m = re.fullmatch(r'/__shot/([A-Za-z0-9_.-]+\.png)', self.path)
        if not m: self.send_response(403); self.end_headers(); return
        n = int(self.headers.get('Content-Length', 0))
        with open(os.path.join(OUT, m.group(1)), 'wb') as f: f.write(self.rfile.read(n))
        self.send_response(201); self.end_headers()
    def log_message(self, *a): pass

print(f'http://localhost:{PORT}  (root {ROOT}, shots → {OUT})', flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=ROOT)).serve_forever()
