// Owned desktop JSC processes; self-written startup responses; no client/network.
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir,platform,arch} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceBuffer} from './source-snapshot.mjs';
import {makeFixtures,makeHarness,oracle} from '../Loon/Development/SpotifyMobileMemory20261114/fixtures.mjs';
if(platform()!=='darwin')throw Error('Requires macOS JavaScriptCore');
const root=fileURLToPath(new URL('../',import.meta.url));
const option=process.argv.find(a=>a.startsWith('--baseline-dir='));
if(!option)throw Error('Provide the verified beta.1 runtime snapshot with --baseline-dir=...');
const before=resolve(option.slice(option.indexOf('=')+1)),after=join(root,'build/current-runtime/runtime');
const sha=b=>createHash('sha256').update(b).digest('hex');
const pin=JSON.parse(readFileSync(join(before,'provenance/runtime-release.json')));
for(const item of pin.artifacts){const b=readFileSync(join(before,item.path));if(b.length!==item.bytes||sha(b)!==item.sha256)throw Error('Unverified baseline: '+item.path);}
const scratch=mkdtempSync(join(tmpdir(),'spotify-startup-memory-'));
try{
  writeFileSync(join(scratch,'package.json'),'{"type":"module"}');mkdirSync(join(scratch,'core'));
  writeFileSync(join(scratch,'core/spotify-lyrics.js'),readFileSync(join(root,'src/spotify-lyrics.js')));
  for(const name of ['lyric-startup-fixture.mjs','startup-fixtures.mjs'])writeFileSync(join(scratch,name),sourceBuffer('10049053ce86bd992e3ebb6511ffb28312ba86fb','Surge/Development/VerseLyrics322/'+name));
  const all=await makeFixtures(pathToFileURL(scratch+'/'));
  const {startupFixture,kinds}=await import(pathToFileURL(join(scratch,'startup-fixtures.mjs')));
  const core=await import(pathToFileURL(join(scratch,'core/spotify-lyrics.js'))),{join:wire,dataField:d,stringField:s,numberField:n}=core;
  const base=all.cases.find(f=>f.name==='english-cold-filled');
  const cases=kinds.map(kind=>({...base,...startupFixture(kind,120000),name:kind,entry:true,status:200,rows:[]}));
  for(const state of ['off','on','missing'])for(const kind of ['customize','bootstrap']){
    const parts=[s(1,'self-written-dense-config'),n(2,1000)];
    const assignment=(scope,name,value)=>d(3,wire([d(1,wire([s(1,scope),s(2,name)])),d(3,n(1,value))]));
    for(let i=0;i<3000;i++)parts.push(assignment('unrelated','setting'+i,0));
    parts.push(assignment('ios-feature-lyrics',state==='missing'?'other-property':'enable_has_lyrics_check_bypass',state==='on'?1:0));
    let body=wire(parts);body=wire([body,s(98,'x'.repeat(Math.max(0,120000-body.length-8)))]);
    if(kind==='bootstrap')for(const field of [1,1,1,1,1,2])body=d(field,body);
    if(body.length>131072)throw Error('Fixture exceeds production entry limit');
    cases.push({...base,...startupFixture(kind),body,name:'dense-'+kind+'-'+state,entry:true,status:200,rows:[]});
  }
  const runner=join(root,'Loon/Development/SpotifyMobileMemory20261114/footprint-runner.c'),binary=join(scratch,'runner');
  execFileSync('clang',['-isysroot','/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk','-O2','-Wall','-Wextra','-framework','JavaScriptCore',runner,'-o',binary],{stdio:'pipe'});
  const report={recordedAt:new Date().toISOString(),scope:'Exact native Entry bundles in owned macOS JSC processes; shared synthetic storage; completed contexts held through each wave',host:{platform:platform(),arch:arch()},baselineRelease:pin.release,baselineRuntime:pin.revision,runnerSHA256:sha(readFileSync(runner)),nativeIOSAcceptance:false,referenceBytesExclusive:50000000,limitations:['No iOS extension or native HTTP/TLS buffering','Identical startup responses overlap in this model; not a captured real startup trace','Completed contexts are deliberately retained until the wave ends; no forced GC','1/4/8 contexts are stress inputs, not a documented Loon concurrency limit'],runtimeHashes:{},runs:[]};
  for(const client of ['Loon','Surge'])for(const mode of ['standard','compact'])for(const f of cases){
    const path=client+'/script/SpotifyLyrics.Entry.js',scripts={before:readFileSync(join(before,path)),after:readFileSync(join(after,path))};
    const expected={};
    for(const version of ['before','after'])expected[version]=await oracle(makeHarness(f,mode,all),scripts[version].toString(),f,all);
    if(expected.before.hash!==expected.after.hash||expected.before.calls!==expected.after.calls)throw Error('Startup output drift: '+f.name);
    for(const version of ['before','after']){
      report.runtimeHashes[version+':'+path]=sha(scripts[version]);
      const script=join(scratch,'runtime.js'),host=join(scratch,'host.js');writeFileSync(script,scripts[version]);writeFileSync(host,makeHarness(f,mode,all,expected[version],{sharedStorage:true}));
      for(const concurrency of [1,4,8]){
        const measurement=JSON.parse(execFileSync(binary,[host,script,'1',String(concurrency),'shared'],{encoding:'utf8',timeout:30000,maxBuffer:20000}));
        if(!measurement.peakFootprintSupported||measurement.totalCalls!==0||measurement.maxPendingContexts!==0||!measurement.result.synchronous||measurement.invocations!==concurrency)throw Error('Unexpected native entry execution');
        report.runs.push({version,client,mode,scenario:f.name,bodyBytes:f.body.length,concurrency,measurement});
      }
    }
    console.log(client+' '+mode+' '+f.name+' matched');
  }
  report.summary=Object.fromEntries(['before','after'].map(version=>{const rows=report.runs.filter(r=>r.version===version);return [version,{processes:rows.length,invocations:rows.reduce((n,r)=>n+r.measurement.invocations,0),maxFootprintBytes:Math.max(...rows.map(r=>r.measurement.peakFootprintBytes)),maxResidentBytes:Math.max(...rows.map(r=>r.measurement.peakResidentBytes)),maxMilliseconds:Math.max(...rows.map(r=>r.measurement.milliseconds))}];}));
  writeFileSync(join(root,'evidence/startup-memory-beta2.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
}finally{rmSync(scratch,{recursive:true,force:true});}
