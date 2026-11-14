import {readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync, symlinkSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'provenance/recovery-manifest.json')));
const scratch = mkdtempSync(join(tmpdir(), 'spotifylyrics-baseline-'));
try {
  for (const f of manifest.files) {
    const source = join(root, 'history/3.2.2', f.path);
    if (createHash('sha256').update(readFileSync(source)).digest('hex') !== f.sha256) throw Error('Historical source changed: ' + f.path);
    const dest = join(scratch, f.path); mkdirSync(dirname(dest), {recursive:true}); copyFileSync(source, dest);
  }
  symlinkSync(join(root, 'node_modules'), join(scratch, 'node_modules'), 'dir');
  function command(binary, args) {
    const r = spawnSync(binary, args, {cwd:scratch, encoding:'utf8', maxBuffer:16*1024*1024});
    if (r.status !== 0) throw Error(r.stderr || r.stdout || 'Baseline command failed');
    return r;
  }
  command(process.execPath, ['build.mjs']);
  command('python3', ['package.py', manifest.sourceCommit, '2248']);
  const tests = [...readdirSync(scratch).filter(n => n.endsWith('.test.mjs')), ...readdirSync(join(scratch, 'core/test')).filter(n => n.endsWith('.test.mjs')).map(n => 'core/test/' + n)];
  const result = command(process.execPath, ['--test', '--test-reporter=tap', ...tests]);
  mkdirSync(join(root, 'evidence'), {recursive:true});
  writeFileSync(join(root, 'evidence/baseline-tests.tap'), result.stdout);
  const summary = {recordedAt:new Date().toISOString(), sourceCommit:manifest.sourceCommit, restoredFiles:manifest.files.length, tests:Number(result.stdout.match(/# tests (\d+)/)?.[1]), passed:Number(result.stdout.match(/# pass (\d+)/)?.[1]), failed:Number(result.stdout.match(/# fail (\d+)/)?.[1]), scope:'Historical source in a temporary directory; synthetic transport; not native Spotify acceptance'};
  writeFileSync(join(root, 'evidence/baseline-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(result.stdout.split('\n').slice(-10).join('\n'));
} finally { rmSync(scratch, {recursive:true, force:true}); }
