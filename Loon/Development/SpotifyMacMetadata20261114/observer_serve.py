"""Static exact-file server, only start after explicit diagnostic approval."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, hashlib, json, time
from urllib.parse import urlsplit
ROOT = Path(__file__).resolve().parent

def asset(path):
    manifest = json.loads((ROOT / 'evidence/observer-artifacts.json').read_text())
    item = next((f for f in manifest['files'] if '/' + Path(f['path']).name == path), None)
    if not item:
        return None
    data = (ROOT / item['path']).read_bytes()
    if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
        raise ValueError('Observer asset changed')
    return data

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        try:
            data = asset(urlsplit(self.path).path)
            status = 200 if data is not None else 404
        except (ValueError, OSError):
            data, status = None, 503
        data = data or b''
        self.send_response(status)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        self.send_error(405)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seconds', type=int, default=300)
    seconds = parser.parse_args().seconds
    if not 30 <= seconds <= 600:
        parser.error('--seconds must be between 30 and 600')
    deadline = time.monotonic() + seconds
    with ThreadingHTTPServer(('127.0.0.1', 18767), Handler) as server:
        server.daemon_threads = True
        server.timeout = 0.5
        while time.monotonic() < deadline:
            server.handle_request()
