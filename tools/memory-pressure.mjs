// Measure the actual published/candidate mobile bundles under overlapping work.
// Owned macOS JSC processes, self-written fixtures, no network or client access.
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir,platform,arch} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceBuffer} from './source-snapshot.mjs';
import {validateRelease} from './runtime-release.mjs';
import {makeFixtures,makeHarness,oracle} from '../Loon/Development/SpotifyMobileMemory20261114/fixtures.mjs';

if(platform()!=='darwin')throw Error('Requires macOS JavaScriptCore');
const selection=process.argv.find(a=>a.startsWith('--runtime='))?.slice(10)||'published';
if(!['published','candidate'].includes(selection))throw Error('Use --runtime=published or --runtime=candidate');
const root=fileURLToPath(new URL('../',import.meta.url));
const publishedArgument=process.argv.find(a=>a.startsWith('--published-root='));
const publishedRoot=publishedArgument?resolve(publishedArgument.slice(publishedArgument.indexOf('=')+1)):root;
const runtimeRoot=selection==='published'?publishedRoot:join(root,'build/current-runtime/runtime');
const releaseCompleted=process.argv.includes('--release-completed');
const scratch=mkdtempSync(join(tmpdir(),'spotifylyrics-memory-pressure-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
try {
  let publishedPin=null;
  if(selection==='published') {
    publishedPin=validateRelease(JSON.parse(readFileSync(join(publishedRoot,'provenance/runtime-release.json'),'utf8')));
    if(!/^v\d+\.\d+\.\d+$/.test(publishedPin.release||''))throw Error('Select a published checkout using --published-root=...; this checkout contains a candidate');
    for(const item of publishedPin.artifacts){const bytes=readFileSync(join(publishedRoot,item.path));if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)throw Error('Published checkout has unpinned runtime changes: '+item.path);}
  }
  writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
  mkdirSync(join(scratch,'core'));
  // Encoding fixture data uses the maintained core; measured code is the exact
  // bundle selected above, with its own recorded digest.
  writeFileSync(join(scratch,'core/spotify-lyrics.js'),readFileSync(join(root,'src/spotify-lyrics.js')));
  for(const name of ['lyric-startup-fixture.mjs','startup-fixtures.mjs'])writeFileSync(join(scratch,name),sourceBuffer('10049053ce86bd992e3ebb6511ffb28312ba86fb','Surge/Development/VerseLyrics322/'+name));
  const all=await makeFixtures(pathToFileURL(scratch+'/'));
  const {encodeDocument}=await import(pathToFileURL(join(scratch,'core/spotify-lyrics.js')));
  const cases=all.cases.filter(f=>['english-cold-filled','missing-cold-filled','600-english-translation','large-entry-connect-json'].includes(f.name));
  const base=all.cases.find(f=>f.name==='english-cold-filled');
  for(const [name,language,words] of [
    ['600-japanese-medley','ja',Array.from({length:600},(_,i)=>i%2?'I walk beside the quiet sea '+i:'海の灯りが揺れる '+i)],
    ['600-Chinese-English-fragments','zh',Array.from({length:600},(_,i)=>'原創紙燈 says hello '+i)]
  ])cases.push({...base,name,rows:words,body:encodeDocument({lyrics:{syncType:'LINE_SYNCED',language,provider:'Synthetic',providerDisplayName:'Synthetic',lines:words.map((words,i)=>({words,startTimeMs:String(1000+i*2200)})),alternatives:[]},colors:{background:-10985626,text:-1}},'protobuf')});
  const runner=join(root,'Loon/Development/SpotifyMobileMemory20261114/footprint-runner.c'),binary=join(scratch,'runner');
  execFileSync('clang',['-isysroot','/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk','-O2','-Wall','-Wextra','-framework','JavaScriptCore',runner,'-o',binary],{stdio:'pipe'});
  const report={schema:1,recordedAt:new Date().toISOString(),selection,publishedRuntimeRevision:publishedPin?.revision||null,releaseCompletedContexts:releaseCompleted,runnerSHA256:sha(readFileSync(runner)),scope:'Owned desktop JSC processes; shared native-string storage and delayed synthetic callbacks',host:{platform:platform(),arch:arch()},nativeIOSAcceptance:false,referenceBytesExclusive:50000000,limitations:['No iOS extension, native HTTP/TLS buffers, Spotify client, or other plugins',releaseCompleted?'Completed contexts are released after evaluation returns from $done, without forced GC; native disposal remains unverified':'Completed contexts deliberately held until the wave ends; disposal may differ on device','Cooperative round-robin scheduling does not prove atomic storage or a native concurrency limit'],runtimeHashes:{},runs:[]};
  for(const client of ['Loon','Surge'])for(const mode of ['standard','compact'])for(const fixture of cases){
    const path=client+'/script/SpotifyLyrics'+(fixture.entry?'.Entry':'')+'.js',runtime=readFileSync(join(runtimeRoot,path));
    report.runtimeHashes[path]=sha(runtime);
    const expected=await oracle(makeHarness(fixture,mode,all),runtime.toString(),fixture,all);
    const script=join(scratch,'runtime.js'),host=join(scratch,'host.js');
    writeFileSync(script,runtime);writeFileSync(host,makeHarness(fixture,mode,all,expected,{sharedStorage:true}));
    for(const concurrency of [1,4,8,16]){
      const measurement=JSON.parse(execFileSync(binary,[host,script,'1',String(concurrency),'shared',...(releaseCompleted?['release-completed']:[])],{encoding:'utf8',timeout:30000,maxBuffer:20000}));
      if(measurement.invocations!==concurrency||measurement.concurrency!==concurrency||measurement.totalCalls!==expected.calls)throw Error('Unexpected invocation or HTTP count');
      if(!fixture.entry&&measurement.maxPendingContexts!==1)throw Error('Unexpected pending network owner count');
      report.runs.push({client,mode,scenario:fixture.name,concurrency,measurement});
    }
    console.log(client+' '+mode+' '+fixture.name+' complete');
  }
  const max=key=>Math.max(...report.runs.map(r=>r.measurement[key]));
  report.summary={processes:report.runs.length,invocations:report.runs.reduce((n,r)=>n+r.measurement.invocations,0),maxFootprintBytes:max('peakFootprintBytes'),maxResidentBytes:max('peakResidentBytes')};
  report.summary.byConcurrency=[1,4,8,16].map(concurrency=>({concurrency,maxFootprintBytes:Math.max(...report.runs.filter(r=>r.concurrency===concurrency).map(r=>r.measurement.peakFootprintBytes)),maxResidentBytes:Math.max(...report.runs.filter(r=>r.concurrency===concurrency).map(r=>r.measurement.peakResidentBytes))}));
  report.summary.belowDesktopReference=report.summary.maxFootprintBytes<50000000&&report.summary.maxResidentBytes<50000000;
  const output=join(root,'evidence/memory-pressure-'+selection+(releaseCompleted?'-immediate':'')+'.json');
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,...report.summary}));
}finally{rmSync(scratch,{recursive:true,force:true});}
