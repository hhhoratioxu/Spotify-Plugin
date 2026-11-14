import {readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const groups = ['tools', 'Loon/Development/SpotifyMac20261114', 'Loon/Development/SpotifyMacMetadata20261114', 'Loon/Development/SpotifySubscription20261114', 'Loon/Development/SpotifyMobileMemory20261114'];
const files = groups.flatMap(p => readdirSync(join(root, p)).filter(n => n.endsWith('.test.mjs')).map(n => p + '/' + n));
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {cwd:root, encoding:'utf8', maxBuffer:8*1024*1024});
const number = pattern => Number((result.stdout || '').match(pattern)?.[1] || 0);
const summary = {recordedAt:new Date().toISOString(),node:{tests:number(/# tests (\d+)/),passed:number(/# pass (\d+)/),failed:number(/# fail (\d+)/),skipped:number(/# skipped (\d+)/),cancelled:number(/# cancelled (\d+)/)},python:{tests:0,passed:0,groups:[]},success:false,scope:'Offline VM/fixtures and Python unit tests; packaged client modules use mocks; no native Loon or Spotify actions'};
const save = () => writeFileSync(join(root,'evidence/regression-summary.json'),JSON.stringify(summary,null,2)+'\n');
mkdirSync(join(root, 'evidence'), {recursive:true}); writeFileSync(join(root, 'evidence/regression-tests.tap'), result.stdout || '');
save();
process.stdout.write((result.stdout || '').split('\n').slice(-14).join('\n')); if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);
for (const dir of ['Loon/Development/SpotifyMac20261114', 'Loon/Development/SpotifyNativeMemory20261114', 'Loon/Development/SpotifyMacMetadata20261114']) {
  const r = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', dir, '-p', '*_test.py'], {cwd:root, encoding:'utf8'});
  const count=Number(((r.stdout||'')+'\n'+(r.stderr||'')).match(/Ran (\d+) tests?/)?.[1]||0);
  summary.python.groups.push({directory:dir,tests:count,success:r.status===0});summary.python.tests+=count;if(r.status===0)summary.python.passed+=count;save();
  process.stdout.write(r.stdout); process.stderr.write(r.stderr); if (r.status !== 0) process.exit(r.status || 1);
}
summary.success=true;save();
