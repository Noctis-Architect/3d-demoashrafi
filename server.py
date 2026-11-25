#!/usr/bin/env python3
"""سرور محلی برای تست: http روی 8001 و https (گواهی خودامضا) روی 8443.
اندروید فقط روی https اجازه AR وب (WebXR) می‌دهد؛ آیفون روی http هم کار می‌کند."""
import http.server, ssl, socket, subprocess, threading, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def lan_ip():
    # آدرس وای‌فای/شبکه خانه (نه VPN یا داکر): اول آدرس‌های 192.168 و 10.x
    ips = subprocess.run(["hostname", "-I"], capture_output=True, text=True).stdout.split()
    for pre in ("192.168.", "10."):
        for a in ips:
            if a.startswith(pre): return a
    return next((a for a in ips if ":" not in a), "127.0.0.1")

def free_port(start):
    for p in range(start, start + 100):
        s = socket.socket()
        try: s.bind(("", p)); return p
        except OSError: pass
        finally: s.close()

ip = lan_ip()
all_ips = sorted(set(subprocess.run(["hostname", "-I"], capture_output=True, text=True).stdout.split() + [ip, "127.0.0.1"]))
all_ips = [a for a in all_ips if ":" not in a]
cert, key = ".cert/cert.pem", ".cert/key.pem"
old_ip = open(".cert/ip").read() if os.path.exists(".cert/ip") else None
if not os.path.exists(cert) or old_ip != ip:
    os.makedirs(".cert", exist_ok=True)
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "825",
                    "-keyout", key, "-out", cert, "-subj", "/CN=sofa-local",
                    "-addext", "subjectAltName=" + ",".join(f"IP:{a}" for a in all_ips) + ",DNS:localhost"],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    open(".cert/ip", "w").write(ip)

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".glb": "model/gltf-binary"}
    def log_message(self, *a): pass
    # کلید گواهی، پیشنهاد قیمت و فایل‌های گیت روی شبکه دیده نشوند
    HIDDEN = ("/.cert", "/private", "/.git", "/.claude", "/server.py", "/run.sh")
    def _hidden(self):
        p = self.path.split("?")[0]
        return any(p == h or p.startswith(h + "/") for h in self.HIDDEN)
    def do_GET(self):
        if self._hidden(): self.send_error(404); return
        super().do_GET()
    def do_HEAD(self):
        if self._hidden(): self.send_error(404); return
        super().do_HEAD()
    # فقط برای ساخت فایل‌های آماده AR از همین کامپیوتر (?genar): ذخیره در پوشه ar/
    def do_PUT(self):
        name = os.path.basename(self.path.split("?")[0])
        if self.client_address[0] != "127.0.0.1" or not self.path.startswith("/ar/") or not name.endswith(".glb"):
            self.send_error(403); return
        os.makedirs("ar", exist_ok=True)
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        with open(os.path.join("ar", name), "wb") as f: f.write(data)
        self.send_response(201); self.end_headers()

hp, sp = free_port(8001), free_port(8443)
httpd = http.server.ThreadingHTTPServer(("", hp), H)
httpsd = http.server.ThreadingHTTPServer(("", sp), H)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(cert, key)
httpsd.socket = ctx.wrap_socket(httpsd.socket, server_side=True)
print(f"کامپیوتر:          http://localhost:{hp}")
print(f"آیفون (همین وای‌فای): http://{ip}:{hp}")
print(f"اندروید با AR:      https://{ip}:{sp}   (هشدار امنیتی را با Advanced → Proceed رد کنید)", flush=True)
threading.Thread(target=httpsd.serve_forever, daemon=True).start()
httpd.serve_forever()
