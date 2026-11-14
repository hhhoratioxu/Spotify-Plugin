"""Only original B assets and the five approved diagnostic fields. Not running on import."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import argparse, hashlib, json, re, time
ROOT = Path(__file__).resolve().parent / 'strict'
ROOTS = {'strict': ROOT, 'repair': ROOT.parent.parent / 'SpotifyMacMetadata20261114' / 'repair'}
EVENTS = []
ROUTES = {'lyrics', 'extended-metadata', 'metadata', 'connect-state', 'context-resolve', 'player-cards', 'lyrics-entry', 'other'}

def valid_event(event):
    return (isinstance(event, dict) and set(event) == {'route', 'stage', 'pair', 'publicTargetMatched', 'lyricsFlags'}
            and isinstance(event['route'], str) and event['route'] in ROUTES
            and isinstance(event['stage'], str) and event['stage'] in {'before', 'after'}
            and isinstance(event['pair'], str) and re.fullmatch(r'[0-9a-f]{16}', event['pair']) is not None
            and type(event['publicTargetMatched']) is bool
            and isinstance(event['lyricsFlags'], list) and 1 <= len(event['lyricsFlags']) <= 16
            and all(type(v) is bool or v in ('omitted', 'unknown') for v in event['lyricsFlags']))

def asset(path):
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    item = next((f for f in manifest['files'] if '/' + f['file'] == path), None)
    if not item:
        return None
    data = (ROOT / item['file']).read_bytes()
    if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
        raise ValueError('B strict asset changed')
    return data

class Handler(BaseHTTPRequestHandler):
    def setup(self):
        self.request.settimeout(1)
        super().setup()

    def log_message(self, *_):
        pass

    def send(self, status, data=b'', content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/events':
            self.send(200, json.dumps(EVENTS).encode())
            return
        try:
            data = asset(self.path)
            self.send(200 if data is not None else 404, data or b'', 'text/plain; charset=utf-8')
        except (ValueError, OSError):
            self.send(503)

    def do_POST(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if self.path != '/events' or not 0 < size <= 4096 or self.headers.get('Origin') or self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                self.send(400)
                return
            event = json.loads(self.rfile.read(size))
            if not valid_event(event):
                self.send(400)
                return
            if len(EVENTS) < 400:
                EVENTS.append(event)
            self.send(204)
        except (ValueError, TypeError, OSError):
            self.send(400)

class Server(HTTPServer):
    def handle_error(self, *_):
        pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seconds', type=int, default=600)
    parser.add_argument('--variant', choices=tuple(ROOTS), default='strict')
    args = parser.parse_args()
    seconds = args.seconds
    ROOT = ROOTS[args.variant]
    if not 30 <= seconds <= 600:
        parser.error('--seconds must be between 30 and 600')
    deadline = time.monotonic() + seconds
    with Server(('127.0.0.1', 18765), Handler) as server:
        server.timeout = 0.5
        while time.monotonic() < deadline:
            server.handle_request()
