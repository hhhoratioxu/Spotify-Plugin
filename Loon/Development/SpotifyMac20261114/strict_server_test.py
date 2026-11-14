from io import BytesIO
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from strict_server import Handler, EVENTS, asset, valid_event
ROOT = Path(__file__).resolve().parent

def event():
    return {'route': 'connect-state', 'stage': 'before', 'pair': '0123456789abcdef', 'publicTargetMatched': True, 'lyricsFlags': [False]}

def post(data, origin=None):
    raw = json.dumps(data).encode()
    handler = object.__new__(Handler)
    handler.path = '/events'
    handler.command = 'POST'
    handler.request_version = 'HTTP/1.1'
    handler.requestline = 'POST /events HTTP/1.1'
    handler.headers = {'Content-Type': 'application/json', 'Content-Length': str(len(raw))}
    if origin:
        handler.headers['Origin'] = origin
    handler.rfile = BytesIO(raw)
    handler.wfile = BytesIO()
    handler.do_POST()
    return handler.wfile.getvalue()

class StrictB(unittest.TestCase):
    def setUp(self):
        EVENTS.clear()

    def test_only_approved_schema_accepted(self):
        self.assertTrue(valid_event(event()))
        self.assertIn(b' 204 ', post(event()))
        self.assertEqual(EVENTS, [event()])

    def test_extra_telemetry_and_sensitive_values_rejected(self):
        for key in ['status', 'bytes', 'format', 'method', 'mime', 'url', 'Authorization', 'body']:
            data = {**event(), key: 'PRIVATE_FIXTURE_DATA'}
            self.assertIn(b' 400 ', post(data))
        self.assertEqual(EVENTS, [])

    def test_malformed_enum_and_origin_rejected(self):
        for change in [{'route': 'PRIVATE_FIXTURE_URL'}, {'stage': []}, {'pair': 'PRIVATE_FIXTURE_TOKEN'}, {'lyricsFlags': ['PRIVATE_FIXTURE_TEXT']}, {'lyricsFlags': [1]}, {'publicTargetMatched': 'true'}, {'publicTargetMatched': 'unknown'}]:
            self.assertIn(b' 400 ', post({**event(), **change}))
        self.assertIn(b' 400 ', post(event(), origin='http://fixture.invalid'))
        self.assertEqual(EVENTS, [])

    def test_bounded_memory(self):
        EVENTS.extend([event()] * 400)
        self.assertIn(b' 204 ', post(event()))
        self.assertEqual(len(EVENTS), 400)

    def test_exact_assets_only(self):
        manifest = json.loads((ROOT / 'strict/manifest.json').read_text())
        for item in manifest['files']:
            self.assertEqual(asset('/' + item['file']), (ROOT / 'strict' / item['file']).read_bytes())
        for path in ['/../AGENTS.md', '/MetadataObserveMac.lpx', '/SpotifyLyrics.Mac.Fallback.Candidate.js']:
            self.assertIsNone(asset(path))

    def test_repair_variant_serves_only_its_four_hashed_assets(self):
        root = ROOT.parent / 'SpotifyMacMetadata20261114' / 'repair'
        manifest = json.loads((root / 'manifest.json').read_text())
        self.assertEqual(len(manifest['files']), 4)
        with patch('strict_server.ROOT', root):
            for item in manifest['files']:
                self.assertEqual(asset('/' + item['file']), (root / item['file']).read_bytes())
            for path in ['/DiagnosisMac.lpx', '/../strict/DiagnosisMac.lpx', '/MetadataObserveMac.lpx']:
                self.assertIsNone(asset(path))
