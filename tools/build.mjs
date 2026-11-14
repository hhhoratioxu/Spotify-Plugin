import {readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, copyFileSync, symlinkSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {setDisplayName} from './display-name.mjs';
import {verifySnapshots} from './source-snapshot.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const recovery = JSON.parse(readFileSync(join(root, 'provenance/recovery-manifest.json')));
const scratch = mkdtempSync(join(tmpdir(), 'spotifylyrics-build-'));
const sha = b => createHash('sha256').update(b).digest('hex');
try {
  verifySnapshots();
  for (const f of recovery.files) {
    const source = join(root, 'history/3.2.2', f.path), bytes = readFileSync(source);
    if (sha(bytes) !== f.sha256) throw Error('Historical source changed: ' + f.path);
    const dest = join(scratch, f.path); mkdirSync(dirname(dest), {recursive:true}); copyFileSync(source, dest);
  }
  // Maintain the restored implementation in src; do not compile the isolated
  // recovery experiment kept under archive/SpotifyLyricsPlus/src.
  for (const [source, dest] of Object.entries({'spotify-lyrics.js':'core/spotify-lyrics.js','native-adapter.js':'native-adapter.js','native-flow.mjs':'native-flow.mjs','NOTICE-UNICODE.txt':'core/NOTICE-UNICODE.txt'})) copyFileSync(join(root, 'src', source), join(scratch, dest));
  symlinkSync(join(root, 'node_modules'), join(scratch, 'node_modules'), 'dir');
  execFileSync(process.execPath, ['build.mjs'], {cwd:scratch, stdio:'pipe'});
  const artifacts = [];
  function installTree(dir, relative = '') {
    for (const item of readdirSync(dir, {withFileTypes:true})) {
      const path = join(relative, item.name), source = join(dir, item.name);
      if (item.isDirectory()) { installTree(source, path); continue; }
      const bytes = readFileSync(source), dest = join(root, path);
      mkdirSync(dirname(dest), {recursive:true}); writeFileSync(dest, bytes);
      artifacts.push({path, bytes:bytes.length, sha256:sha(bytes)});
    }
  }
  installTree(join(scratch, 'runtime'));
  for (const [client, extension] of Object.entries({Surge:'sgmodule', Egern:'yaml', QuantumultX:'conf', Shadowrocket:'sgmodule'})) {
    const path = client + '/script/SpotifyLyrics.' + extension;
    writeFileSync(join(root, path), setDisplayName(readFileSync(join(root, 'provenance/compatibility', path), 'utf8'), client));
  }
  execFileSync(process.execPath, ['build-mac.mjs'], {cwd:join(root, 'Loon/Development/SpotifyMac20261114'), stdio:'pipe'});
  execFileSync(process.execPath, ['build-subscription.mjs', 'artifacts'], {cwd:join(root, 'Loon/Development/SpotifySubscription20261114'), stdio:'pipe'});
  execFileSync(process.execPath, ['build-subscription.mjs', 'profile', '795c677b0d115cab5eb8e4f959424d905a98e3ff'], {cwd:join(root, 'Loon/Development/SpotifySubscription20261114'), stdio:'pipe'});
  // Build the isolated candidate for offline tests only; no install route uses it.
  execFileSync(process.execPath, ['Loon/Development/SpotifyMacMetadata20261114/build-candidate.mjs'], {cwd:root, stdio:'pipe'});
  execFileSync(process.execPath, ['Loon/Development/SpotifyMacMetadata20261114/build-compat.mjs'], {cwd:root, stdio:'pipe'});
  execFileSync(process.execPath, ['Loon/Development/SpotifyMacMetadata20261114/build-repair.mjs'], {cwd:root, stdio:'pipe'});
  execFileSync(process.execPath, ['Loon/Development/SpotifyMacMetadata20261114/build-observer.mjs'], {cwd:root, stdio:'pipe'});
  execFileSync(process.execPath, ['Loon/Development/SpotifyMac20261114/build-strict-diagnosis.mjs'], {cwd:root, stdio:'pipe'});
  mkdirSync(join(root, 'evidence'), {recursive:true});
  writeFileSync(join(root, 'evidence/build.json'), JSON.stringify({core:'3.2.2', displayName:'SpotifyLyrics', inputs:'local source snapshots and src; no parent Git lookup', network:'none', subscriptionURLsChanged:false, artifacts}, null, 2) + '\n');
  console.log(JSON.stringify({built:artifacts.length, core:'3.2.2', published:false}));
} finally { rmSync(scratch, {recursive:true, force:true}); }
