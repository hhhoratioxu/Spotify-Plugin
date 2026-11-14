"""Loopback fixture service. It never reads account data or production caches."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
import time
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / 'runtime'
RESULTS = []
LOCK = threading.Lock()
WORDS = ['I watch the paper lantern '+str(i)+'.' for i in range(48)]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send(self, status, data, kind='application/json'):
        data = data if isinstance(data, bytes) else data.encode()
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        p = urlsplit(self.path)
        if p.path in ['/MemoryTest.lpx', '/canary.js', '/mobile.js', '/macos.js']:
            self.send(200, (RUNTIME / p.path[1:]).read_bytes(), 'text/plain; charset=utf-8')
        elif p.path.startswith('/data/') and p.path[6:-5].isdigit() and p.path.endswith('.json'):
            fixture = json.loads((RUNTIME / 'data' / p.path[6:]).read_text())
            # Refresh the synthetic expiration timestamps without altering real storage.
            for pair in fixture['store']:
                cache = json.loads(pair[1])
                for e in cache['entries']:
                    e['expires'] = int(time.time()*1000)+600000
                parts = [json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in cache['entries']]
                pair[1] = '{"sizes":'+json.dumps([len(e) for e in parts], separators=(',', ':'))+',"entries":['+','.join(parts)+'],"cooldowns":{}}'
            self.send(200, json.dumps(fixture, ensure_ascii=False))
        elif p.path in ['/service/source', '/service/translation']:
            q = parse_qs(p.query)
            index = int(q.get('case', ['-1'])[0])
            if not 0 <= index < 18:
                self.send(400, '{}')
                return
            fixture = json.loads((RUNTIME / 'data' / (str(index)+'.json')).read_text())
            if fixture['failure']:
                time.sleep(3)
                self.send(503, '{}')
            elif fixture['oversizedService']:
                self.send(200, 'x'*98305)
            elif p.path.endswith('/source'):
                lrc = '\n'.join('[%02d:%05.2f]%s' % ((i*2100+1000)//60000, ((i*2100+1000)%60000)/1000, w) for i, w in enumerate(WORDS))
                self.send(200, json.dumps({'trackName':'Paper Lantern','artistName':'Ada North','albumName':'Quiet Walk','duration':180,'syncedLyrics':lrc}))
            else:
                original = parse_qs(urlsplit(q.get('query', [''])[0]).query).get('q', [])
                translated = ['自写中文译文 '+str(WORDS.index(w)) if w in WORDS else '自写译文' for w in original]
                self.send(200, json.dumps(translated, ensure_ascii=False))
        elif p.path == '/results':
            with LOCK:
                self.send(200, json.dumps(RESULTS))
        else:
            self.send(404, '{}')

    def do_POST(self):
        if self.path != '/result':
            self.send(404, '{}')
            return
        size = int(self.headers.get('Content-Length', '0'))
        if not 0 < size <= 4096:
            self.send(400, '{}')
            return
        result = json.loads(self.rfile.read(size))
        allowed = {'executionHost','variant','mode','index','name','inputBytes','outputBytes','hash','expectedHash','calls','expectedCalls','peakPending','completions','milliseconds','matchesReference'}
        if set(result) - allowed:
            self.send(400, '{}')
            return
        with LOCK:
            if len(RESULTS) >= 256:
                self.send(429, '{}')
                return
            RESULTS.append(result)
            (ROOT/'evidence').mkdir(exist_ok=True)
            for host, name in [('Loon', 'native-fixture-results.json'), ('Node-preflight', 'node-preflight-results.json')]:
                rows = [r for r in RESULTS if r.get('executionHost') == host]
                if rows:
                    (ROOT/'evidence'/name).write_text(json.dumps(rows, indent=2)+'\n')
        self.send(204, b'')


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 18766), Handler)
    server.serve_forever()
