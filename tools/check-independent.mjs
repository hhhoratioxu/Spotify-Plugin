import {cpSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join, basename, dirname, relative} from 'node:path';
import {spawnSync} from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'spotifylyrics-independent-'));
const commands = [];
const env = {...process.env, PATH:dirname(process.execPath) + ':' + process.env.PATH, GIT_DIR:join(scratch,'.git-unavailable'), GIT_CEILING_DIRECTORIES:scratch};
const report = {recordedAt:new Date().toISOString(), scope:'Copy outside Proxy with no Git database and freshly installed locked dependencies; build and fixture tests only', parentGitAvailable:false, commands, success:false, nativeAcceptance:false};
try {
  cpSync(root, scratch, {recursive:true, filter:path => {
    const rel = relative(root,path);
    if (!rel) return true;
    if (rel.split('/').some(p => ['.git','.migration-backup','node_modules','__pycache__'].includes(p))) return false;
    if (rel === 'build' || rel.startsWith('build/') || rel === 'evidence' || rel.startsWith('evidence/')) return false;
    return true;
  }});
  const git = spawnSync('git',['rev-parse','--git-dir'],{cwd:scratch,env,encoding:'utf8'});
  if (git.status === 0) throw Error('Independent check unexpectedly has a Git database');
  for (const [binary,args,label] of [
    ['npm',['ci','--ignore-scripts','--no-audit','--no-fund'],'install'],
    [process.execPath,['tools/build.mjs'],'build'],
    [process.execPath,['Loon/Development/SpotifyNativeMemory20261114/prepare.mjs'],'memory-fixture-build'],
    [process.execPath,['Loon/Development/SpotifyNativeMemory20261114/preflight-offline.mjs'],'memory-fixture-preflight'],
    [process.execPath,['tools/test.mjs'],'regression'],
    [process.execPath,['tools/test-baseline.mjs'],'baseline'],
  ]) {
    const started = Date.now();
    const result = spawnSync(binary,args,{cwd:scratch,env,encoding:'utf8',maxBuffer:16*1024*1024});
    const entry = {label,command:[basename(binary),...args],exitCode:result.status,durationMs:Date.now()-started,tail:((result.stdout||'')+'\n'+(result.stderr||'')).split('\n').slice(-16).join('\n')};
    commands.push(entry); console.log(label + ': exit ' + result.status + '\n' + entry.tail);
    if (result.status !== 0) throw Error('Independent ' + label + ' failed');
  }
  report.success = true;
  report.regression = JSON.parse(readFileSync(join(scratch,'evidence/regression-summary.json')));
  report.baseline = JSON.parse(readFileSync(join(scratch,'evidence/baseline-summary.json')));
  report.build = JSON.parse(readFileSync(join(scratch,'evidence/build.json')));
  const memory=JSON.parse(readFileSync(join(scratch,'Loon/Development/SpotifyNativeMemory20261114/evidence/offline-preflight-summary.json')));
  report.memoryBridge={scope:memory.scope,listenerStarted:memory.listenerStarted,networkRequests:memory.networkRequests,completed:memory.rows.length,matched:memory.rows.filter(r=>r.matchesReference).length};
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally {
  mkdirSync(join(root,'evidence'),{recursive:true});
  writeFileSync(join(root,'evidence/independence.json'),JSON.stringify(report,null,2)+'\n');
  rmSync(scratch,{recursive:true,force:true});
}
