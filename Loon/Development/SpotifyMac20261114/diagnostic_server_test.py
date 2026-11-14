"""Exercise the exact GET handler without opening a listening socket."""
from io import BytesIO
import json
from pathlib import Path
import unittest
from serve import Handler

ROOT = Path(__file__).resolve().parent


def get(path):
    handler = object.__new__(Handler)
    handler.path = path
    handler.request_version = 'HTTP/1.1'
    handler.requestline = 'GET ' + path + ' HTTP/1.1'
    handler.command = 'GET'
    handler.wfile = BytesIO()
    handler.do_GET()
    return handler.wfile.getvalue().partition(b'\r\n\r\n')


class DiagnosticRoutes(unittest.TestCase):
    def test_exact_diagnostic_import_file(self):
        headers, _, body = get('/DiagnosisMac.lpx')
        self.assertIn(b' 200 ', headers)
        self.assertEqual(body, (ROOT / 'DiagnosisMac.lpx').read_bytes())

    def test_each_versioned_runtime_is_served_byte_for_byte(self):
        manifest = json.loads((ROOT / 'evidence/diagnosis-artifacts.json').read_text())
        for artifact in manifest['files']:
            if 'productionSource' not in artifact:
                continue
            headers, _, body = get('/' + Path(artifact['file']).name)
            self.assertIn(b' 200 ', headers)
            self.assertEqual(body, (ROOT / artifact['file']).read_bytes())

    def test_unknown_paths_and_hashes_cannot_read_arbitrary_files(self):
        for path in [
            '/SpotifyLyrics.Diagnosis.lyrics.' + '0' * 16 + '.js',
            '/SpotifyLyrics.Diagnosis.lyrics.' + 'a' * 16 + '.js/../../serve.py',
            '/SpotifyLyrics.Diagnosis.lyrics.' + 'a' * 16 + '.js?secret=value',
            '/runtime/../serve.py', '/%2e%2e/serve.py',
        ]:
            headers, _, _ = get(path)
            self.assertIn(b' 404 ', headers)


if __name__ == '__main__':
    unittest.main()
