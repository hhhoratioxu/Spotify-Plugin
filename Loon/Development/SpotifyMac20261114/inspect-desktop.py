"""Read static Spotify application facts; never inspect profiles or execute UI code.

Only emits names, counts, offsets, hashes and verified boolean conditions.
If the installed bundle changes shape, fail instead of inventing a data source.
"""
import hashlib
import json
from pathlib import Path
import plistlib
import re
from zipfile import ZipFile


def inspect(app=Path('/Applications/Spotify.app')):
    archive = app / 'Contents/Resources/Apps/xpui.spa'
    with (app / 'Contents/Info.plist').open('rb') as f:
        version = plistlib.load(f)['CFBundleShortVersionString']
    with ZipFile(archive) as z:
        raw = z.read('dwp-now-playing-bar.js')
        source = raw.decode('utf-8')
        # A bounded structural match of this installed client's lyric button.
        pattern = (r'([\w$]+)=\w+\.memo\(\(\{onClick:([\w$]+),className:([\w$]+),'
                   r'isActive:([\w$]+),isEnabled:([\w$]+)\}\)=>\{.{0,800}?'
                   r'testId:"lyrics-button".{0,100}?\}\)\}\)')
        button = re.search(pattern, source)
        if not button:
            raise RuntimeError('Installed lyric button structure not recognized')
        symbol, click, _, _, enabled = button.groups()
        text = button.group()
        disabled = re.search(r'disabled:!' + re.escape(enabled) + r'[,}]', text) is not None
        no_toggle = 'onToggle:' + enabled + '?' + click + ':void 0' in text
        query_input = re.search(r'\.data\?\.hasLyrics;return.{0,150}?' + re.escape(symbol) + r',\{[^}]{0,100}isEnabled:', source)
        track_input = re.search(r'\)\.hasLyrics;return.{0,150}?' + re.escape(symbol) + r',\{[^}]{0,100}isEnabled:', source)
        if not all((disabled, no_toggle, query_input, track_input)):
            raise RuntimeError('Installed lyric button inputs not recognized')
        schema = z.read('7309.js').decode('utf-8')
        field13 = len(re.findall(r'case 13:if\(104!==\w+\)break;\w+\.hasLyrics=\w+\.bool\(\)', schema))
        if field13 < 1:
            raise RuntimeError('TrackMetadata field 13 decoder not recognized')
    return {
        'scope': 'Static application artifact only; no UI execution or captured network response',
        'spotifyVersion': version,
        'archiveSHA256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'bundle': 'dwp-now-playing-bar.js',
        'bundleSHA256': hashlib.sha256(raw).hexdigest(),
        'buttonCharacterOffset': button.start(),
        'disabledWhenIsEnabledFalse': disabled,
        'toggleCallbackAbsentWhenIsEnabledFalse': no_toggle,
        'consumerInputs': ['hook result data.hasLyrics', 'track URI hook result hasLyrics'],
        'trackMetadataHasLyricsFieldNumber': 13,
        'matchingField13Decoders': field13,
        'hookImplementationResolved': False,
        'networkSourceResolved': False,
        'rootCauseEstablished': False,
        'limitations': [
            'The decoded TrackMetadata is distinct from spotify.metadata.Track field 18.',
            'No causal link between either hook and a captured HTTPS route has been established.',
            'This does not show that ConnectState edits can enable the desktop lyrics button.'
        ]
    }


if __name__ == '__main__':
    print(json.dumps(inspect(), ensure_ascii=False, indent=2))
