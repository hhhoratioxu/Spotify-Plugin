"""Synthetic recovery rehearsal only. No CLI accepts real Loon paths."""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
import shutil

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def drill():
    with TemporaryDirectory(prefix='spotify-b-recovery-drill-') as scratch:
        root = Path(scratch)
        live, backup = root / 'fixture-live', root / 'fixture-backup'
        files = {
            'profiles/first.conf': b'# self-written first config\n',
            'profiles/second.conf': b'# self-written second config\n',
            'scripts/shared-request.js': b'// self-written shared request fixture\n',
            'scripts/shared-lyrics.js': b'// self-written shared lyric fixture\n',
            'scripts/shared-entry.js': b'// self-written shared entry fixture\n',
        }
        hashes = {}
        for name, data in files.items():
            path, copy = live / name, backup / name
            path.parent.mkdir(parents=True, exist_ok=True)
            copy.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            shutil.copy2(path, copy)
            hashes[name] = digest(copy)
        # Exercise only files just created in this TemporaryDirectory.
        for name in ['scripts/shared-request.js', 'scripts/shared-lyrics.js']:
            (live / name).unlink()
        changed = b'# another task changed this synthetic config\n'
        (live / 'profiles/second.conf').write_bytes(changed)
        conflicts, restored = [], []
        for name, expected in hashes.items():
            path, copy = live / name, backup / name
            assert digest(copy) == expected
            if path.exists():
                if digest(path) != expected:
                    conflicts.append(name)
                continue
            # Exclusive creation cannot overwrite an intervening writer.
            with path.open('xb') as stream:
                stream.write(copy.read_bytes())
            assert digest(path) == expected
            restored.append(name)
        assert len(restored) == 2
        assert conflicts == ['profiles/second.conf']
        assert (live / 'profiles/second.conf').read_bytes() == changed
        assert digest(live / 'profiles/first.conf') == hashes['profiles/first.conf']
        # Simulate a new file appearing after a missing-file plan was made.
        raced = live / 'scripts/race.js'
        raced.write_bytes(b'concurrent fixture writer')
        refused = False
        try:
            with raced.open('xb') as stream:
                stream.write(b'would replace a concurrent writer')
        except FileExistsError:
            refused = True
        assert refused and raced.read_bytes() == b'concurrent fixture writer'
        return {'scope': 'Self-written files in a disposable directory; not native Loon recovery',
                'fixtureProfiles': 2, 'fixtureSharedScripts': 3,
                'missingSharedScriptsRestored': 2,
                'concurrentConfigPreserved': True, 'interveningWriterPreserved': True,
                'onlyFreshSelfCreatedSnapshotUsed': True, 'liveLoonFilesAccessed': False,
                'nativeRestorationValidated': False}

if __name__ == '__main__':
    print(json.dumps(drill()))
