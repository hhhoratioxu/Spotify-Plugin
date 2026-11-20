// Replay the previous and candidate import rules, then measure the selected
// startup body scripts in fresh macOS JavaScriptCore processes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {arch,platform,tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {makeFixtures,makeHarness,oracle} from '../Loon/Development/SpotifyMobileMemory20261114/fixtures.mjs';
import {baseline,rules} from '../Loon/Development/SpotifySubscription20261114/build-subscription.mjs';
import {selectLoonRules} from '../Loon/Development/SpotifySubscription20261114/routing-fixture.mjs';
import {sourceBuffer} from './source-snapshot.mjs';
import {validateRelease,verifyRuntimeArtifacts} from './runtime-release.mjs';

if (platform() !== 'darwin' || !process.argv[2]) throw Error('Usage on macOS: node tools/ios-startup-memory.mjs /path/to/previous-dev');
const root=fileURLToPath(new URL('../',import.meta.url));
const entryPath='Loon/script/SpotifyLyrics.Entry.js',profilePath='Loon/script/SpotifyLyrics.lpx';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function readBuild(directory) {
  const pin=validateRelease(JSON.parse(readFileSync(join(directory,'provenance/runtime-release.json'))));
  verifyRuntimeArtifacts(pathToFileURL(resolve(directory)+'/'),pin);
  const profile=readFileSync(join(directory,profilePath));
  const manifest=JSON.parse(readFileSync(join(directory,'Loon/Development/SpotifySubscription20261114/subscription-manifest.json')));
  assert.equal(manifest.runtimeCommit,pin.revision);
  assert.equal(sha(profile),manifest.profile.sha256);
  const runtime=readFileSync(join(directory,entryPath),'utf8');
  return {revision:pin.revision,profileSHA256:sha(profile),runtime,rules:rules(profile.toString(),'Script')};
}
const builds={before:readBuild(process.argv[2]),after:readBuild(root)};
const scratch=mkdtempSync(join(tmpdir(),'spotify-ios-startup-'));
try {
  writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
  mkdirSync(join(scratch,'core'));
  writeFileSync(join(scratch,'core/spotify-lyrics.js'),readFileSync(join(root,'src/spotify-lyrics.js')));
  for (const name of ['lyric-startup-fixture.mjs','startup-fixtures.mjs']) {
    writeFileSync(join(scratch,name),sourceBuffer(baseline,'Surge/Development/VerseLyrics322/'+name));
  }
  const fixtures=await makeFixtures(pathToFileURL(scratch+'/'));
  const {startupFixture,kinds}=await import(pathToFileURL(join(scratch,'startup-fixtures.mjs')));
  const seed=fixtures.cases.find(f=>f.name==='english-cold-filled');
  const cases=kinds.map(kind=>({kind,padding:8000}));
  const bulk=['extended','bootstrap','customize','context-json','connect-protobuf'];
  for (const kind of bulk) cases.push({kind,padding:120000},{kind,padding:120000,omitLength:true});
  cases.push({kind:'connect-json',padding:120000,encoding:'gzip'});
  const runner=join(root,'Loon/Development/SpotifyMobileMemory20261114/footprint-runner.c'),binary=join(scratch,'runner');
  const sdk=execFileSync('xcrun',['--sdk','macosx','--show-sdk-path'],{encoding:'utf8'}).trim();
  execFileSync('clang',['-isysroot',sdk,'-O2','-Wall','-Wextra','-framework','JavaScriptCore',runner,'-o',binary],{stdio:'pipe'});
  const rows=[];
  for (const {kind,padding,omitLength,encoding} of cases) {
    const sample=startupFixture(kind,padding);
    const f={...seed,...sample,name:kind,entry:true,status:200,rows:[]};
    const length=omitLength?null:String(encoding?12000:sample.body.length);
    const headers={url:f.url,contentType:f.type,length,encoding:encoding||null};
    const row={kind,bodyBytes:f.body.length,contentLength:length,contentEncoding:headers.encoding};
    let before;
    for (const [version,build] of Object.entries(builds)) {
      const chosen=selectLoonRules(build.rules,headers);
      assert.ok(chosen.length<=1);
      const selected=chosen.some(line=>line.includes('/SpotifyLyrics.Entry.js"')&&line.includes('requires_body=true'));
      row[version]={selected,bodyBytes:selected?f.body.length:0,peaks:[]};
      if (!selected) continue;
      const expected=await oracle(makeHarness(f,'standard',fixtures),build.runtime,f,fixtures);
      if (version==='before') before=expected;
      else if (before) assert.deepEqual(expected,before,'admitted startup output changed for '+kind);
      const host=join(scratch,'host.js'),script=join(scratch,'runtime.js');
      writeFileSync(host,makeHarness(f,'standard',fixtures,expected,{sharedStorage:true}));
      writeFileSync(script,build.runtime);
      for (const contexts of [1,4,8]) {
        const m=JSON.parse(execFileSync(binary,[host,script,'1',String(contexts),'shared'],{encoding:'utf8',timeout:30000}));
        assert.equal(m.totalCalls,0);
        assert.equal(m.invocations,contexts);
        assert.ok(m.result.synchronous&&m.peakFootprintSupported);
        row[version].peaks.push({contexts,footprintBytes:m.peakFootprintBytes,residentBytes:m.peakResidentBytes});
      }
    }
    rows.push(row);
  }
  const summary=Object.fromEntries(Object.keys(builds).map(version=>{
    const selected=rows.filter(row=>row[version].selected);
    const peaks=selected.flatMap(row=>row[version].peaks);
    return [version,{bodyScripts:selected.length,bodyBytes:selected.reduce((total,row)=>total+row[version].bodyBytes,0),
      maxFootprintBytes:Math.max(...peaks.map(p=>p.footprintBytes)),maxResidentBytes:Math.max(...peaks.map(p=>p.residentBytes))}];
  }));
  const report={recordedAt:new Date().toISOString(),host:{platform:platform(),arch:arch()},runnerSHA256:sha(readFileSync(runner)),
    scope:'Synthetic startup responses selected by the installed profile rules; actual Entry bundles in owned macOS JavaScriptCore processes; completed contexts held until each wave ends',
    nativeIOSAcceptance:false,iosTargetBytesExclusive:40000000,
    limitations:['Rule interpreter models the documented subset of Loon conditions','No iPhone, native HTTP/TLS buffers or other VPN plugins','Repeated waves use identical fixtures; they are not observations of actual Spotify requests'],
    builds:Object.fromEntries(Object.entries(builds).map(([version,b])=>[version,{revision:b.revision,profileSHA256:b.profileSHA256,runtimeSHA256:sha(b.runtime)}])),
    summary,rows};
  mkdirSync(join(root,'evidence'),{recursive:true});
  writeFileSync(join(root,'evidence/ios-startup-memory.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(summary));
} finally {
  rmSync(scratch,{recursive:true,force:true});
}
