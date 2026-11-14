// Additional desktop screening, never native iOS acceptance. No HTTP or UI.
import {execFileSync} from 'node:child_process';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir,platform,arch,release} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {makeFixtures,makeHarness,oracle} from './fixtures.mjs';
import {assessDesktopScreen} from './budget.mjs';
if(platform()!=='darwin')throw Error('macOS JavaScriptCore is required');
const here=fileURLToPath(new URL('.',import.meta.url)),temp=mkdtempSync(join(tmpdir(),'spotify-concurrent-screen-')),pin='10049053ce86bd992e3ebb6511ffb28312ba86fb',source='Surge/Development/VerseLyrics322/',hashes={};
const sha=b=>createHash('sha256').update(b).digest('hex');
const sharedStorage=process.argv.includes('--shared-storage'),waves=sharedStorage?1:3;
try{
  writeFileSync(join(temp,'package.json'),'{"type":"module"}');
  for(const file of ['core/spotify-lyrics.js','lyric-startup-fixture.mjs','startup-fixtures.mjs']){const b=sourceBuffer(pin,source+file),dest=join(temp,file);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,b);hashes[source+file]=sha(b);}
  const binary=join(temp,'footprint-runner');execFileSync('clang',['-isysroot','/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk','-O2','-Wall','-Wextra','-framework','JavaScriptCore',join(here,'footprint-runner.c'),'-o',binary],{stdio:'pipe'});
  const all=await makeFixtures(pathToFileURL(temp+'/')),selected=all.cases.filter(f=>['english-cold-filled','missing-cold-filled','600-english-translation','large-entry-connect-json'].includes(f.name));
  if(selected.length!==4)throw Error('Concurrent fixture set changed');
  const report={recordedAt:new Date().toISOString(),scope:'macOS-JSC-mobile-runtime-screen',host:{platform:platform(),arch:arch(),release:release()},mode:'independent context groups held live, synthetic callbacks stepped round-robin',sharedStorage,waves,provenance:{pin,sha256:hashes,runnerSHA256:sha(readFileSync(join(here,'footprint-runner.c')))},limits:['not an iOS proxy extension','no native TLS/HTTP buffers or other plugins','8 contexts is a screening workload, not a documented Loon concurrency limit','holding completed contexts live is deliberate and may differ from native disposal',sharedStorage?'shared native strings exercise existing advisory admission; cooperative scheduling does not prove atomicity under native races':'isolated stores intentionally prevent cross-context advisory admission; this is not the normal shared-store model'],performed:{ui:false,playback:false,listener:false,network:false,productionChange:false},runs:[]};
  for(const client of ['Loon','Surge'])for(const memoryMode of ['standard','compact'])for(const f of selected){
    const path=client+'/script/SpotifyLyrics'+(f.entry?'.Entry':'')+'.js',runtime=sourceBuffer(pin,path);hashes[path]=sha(runtime);const script=join(temp,'runtime.js');writeFileSync(script,runtime);const expected=await oracle(makeHarness(f,memoryMode,all),runtime.toString(),f,all),host=join(temp,'host.js');writeFileSync(host,makeHarness(f,memoryMode,all,expected,{sharedStorage}));
    for(const concurrency of [1,4,8]){
      const measurement=JSON.parse(execFileSync(binary,[host,script,String(waves),String(concurrency),...(sharedStorage?['shared']:[])],{encoding:'utf8',timeout:30000,maxBuffer:20000}));
      if(measurement.invocations!==waves*concurrency||measurement.concurrency!==concurrency)throw Error('Concurrent execution not verified');
      if(!sharedStorage&&(measurement.result.hash!==expected.hash||measurement.result.calls!==expected.calls))throw Error('Independent bytes or calls changed');
      if(!f.entry&&measurement.maxPendingContexts!==(sharedStorage?1:concurrency))throw Error('Unexpected pending HTTP owner count');
      if(sharedStorage&&measurement.totalCalls!==expected.calls)throw Error('Shared admission duplicated or lost source requests');
      report.runs.push({client,memoryMode,scenario:f.name,concurrency,measurement});
    }
    process.stdout.write(client+' '+memoryMode+' '+f.name+' complete\n');
  }
  report.summary={processes:report.runs.length,invocations:report.runs.reduce((n,r)=>n+r.measurement.invocations,0),maxFootprintBytes:Math.max(...report.runs.map(r=>r.measurement.peakFootprintBytes)),maxResidentBytes:Math.max(...report.runs.map(r=>r.measurement.peakResidentBytes)),assessment:assessDesktopScreen(report)};
  mkdirSync(join(here,'evidence'),{recursive:true});writeFileSync(join(here,'evidence/'+(sharedStorage?'concurrent-shared-screen.json':'concurrent-screen.json')),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
  if(report.summary.assessment.screen!=='below-mobile-reference')process.exitCode=1;
}finally{rmSync(temp,{recursive:true,force:true});}
