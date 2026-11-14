from io import BytesIO
import json
from pathlib import Path
import unittest
from observer_serve import Handler, asset
ROOT = Path(__file__).resolve().parent

class ObserverAssets(unittest.TestCase):
    def test_exact_files_verify_and_read(self):
        manifest = json.loads((ROOT / 'evidence/observer-artifacts.json').read_text())
        for item in manifest['files']:
            self.assertEqual(asset('/' + Path(item['path']).name), (ROOT / item['path']).read_bytes())

    def test_unknown_and_traversal_paths_are_not_served(self):
        for path in ['/../AGENTS.md', '/%2e%2e/AGENTS.md', '/events', '/runtime/', '/SpotifyLyrics.Mac.Fallback.Candidate.js']:
            self.assertIsNone(asset(path))

    def test_handler_serves_exact_import_without_a_socket(self):
        handler = object.__new__(Handler)
        handler.path = '/MetadataObserveMac.lpx?v=fixture'
        handler.request_version = 'HTTP/1.1'
        handler.requestline = 'GET /MetadataObserveMac.lpx HTTP/1.1'
        handler.command = 'GET'
        handler.wfile = BytesIO()
        handler.do_GET()
        head, _, body = handler.wfile.getvalue().partition(b'\r\n\r\n')
        self.assertIn(b' 200 ', head)
        self.assertEqual(body, (ROOT / 'MetadataObserveMac.lpx').read_bytes())
