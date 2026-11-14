"""Read packaged program code only; emit facts, never bundle text or user data."""
from pathlib import Path
import argparse, hashlib, json, re

parser = argparse.ArgumentParser()
parser.add_argument('--snapshot', default='/Applications/Spotify.app/Contents/Frameworks/Chromium Embedded Framework.framework/Versions/A/Resources/v8_context_snapshot.arm64.bin')
args = parser.parse_args()
p = Path(args.snapshot)
data = p.read_bytes()
if len(data) > 64 * 1024 * 1024:
    raise SystemExit('Packaged snapshot exceeds inspector limit')
text = data.decode('utf-16le', errors='ignore')
modules = {}
for mid in ('48071', '68900', '83873', '91243'):
    match = re.search(r'\b' + mid + r'\(e,t,i\)\{', text)
    if not match:
        raise SystemExit('Expected packaged module not found: ' + mid)
    chunk = text[match.start():match.start() + 8000]
    end = re.search(r'\},[0-9]+\(e,t,i\)\{', chunk)
    modules[mid] = chunk[:end.start() + 1] if end else chunk

facts = {
    'availabilityQueryKey': 'useLyricsAvailability' in modules['48071'],
    'availabilityStaleTime600000Ms': 'staleTime:6e5' in modules['48071'],
    'availabilityUsesMetadataHelper': 'i(68900)' in modules['48071'],
    'helperReadsHasLyricsSnakeCase': 'a.body?.has_lyrics||!1' in modules['68900'],
    'helperUsesHostXE': '.withHost(n.XE)' in modules['68900'],
    'hostXEMapsToMetadata4': 'E=`${r}/metadata/4`' in modules['83873'] and 'XE:E' in modules['83873'],
    'lyricsHookUsesAvailability': 'i(48071)' in modules['91243'] and 'hasLyrics:I' in modules['91243'] and 'enabled:I' in modules['91243'],
}
print(json.dumps({'scope': 'Static facts from installed packaged V8 code; no app execution, profile, traffic or account read', 'snapshot': str(p), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'moduleIds': list(modules), 'facts': facts, 'actualTargetResponseCaptured': False, 'nativeAcceptance': False}, indent=2))
if not all(facts.values()):
    raise SystemExit(2)
