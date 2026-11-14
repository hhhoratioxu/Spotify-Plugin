import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir,platform,arch} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceBuffer} from './source-snapshot.mjs';
import {makeFixtures,makeHarness,oracle} from '../Loon/Development/SpotifyMobileMemory20261114/fixtures.mjs';

if(platform()!=='darwin')throw Error('This optional measurement requires macOS JavaScriptCore.');
const root=fileURLToPath(new URL('../',import.meta.url)),scratch=mkdtempSync(join(tmpdir(),'spotifylyrics-multilingual-memory-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
try {
  writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
  mkdirSync(join(scratch,'core'),{recursive:true});writeFileSync(join(scratch,'core/spotify-lyrics.js'),readFileSync(join(root,'src/spotify-lyrics.js')));
  for(const name of ['lyric-startup-fixture.mjs','startup-fixtures.mjs'])writeFileSync(join(scratch,name),sourceBuffer('10049053ce86bd992e3ebb6511ffb28312ba86fb','Surge/Development/VerseLyrics322/'+name));
  const fixtures=await makeFixtures(pathToFileURL(scratch+'/'));
  const {encodeDocument}=await import(pathToFileURL(join(scratch,'core/spotify-lyrics.js')));
  const base=fixtures.cases.find(f=>f.name==='english-cold-filled');
  const cases=fixtures.cases.filter(f=>['600-english-translation','large-json'].includes(f.name));
  for(const [name,language,words] of [
    ['600-japanese-medley','ja',Array.from({length:600},(_,i)=>i%2?'I walk beside the quiet sea '+i:'海の灯りが揺れる '+i)],
    ['600-korean-translation','ko',Array.from({length:600},(_,i)=>'바다 위의 빛 '+i)],
    ['600-Chinese-English-fragments','zh',Array.from({length:600},(_,i)=>'原創紙燈 says hello '+i)]
  ]) {
    const body=encodeDocument({lyrics:{syncType:'LINE_SYNCED',language,provider:'Synthetic',providerDisplayName:'Synthetic',lines:words.map((words,i)=>({words,startTimeMs:String(1000+i*2200)})),alternatives:[]},colors:{background:-10985626,text:-1}},'protobuf');
    cases.push({...base,name,body,rows:words});
  }
  const binary=join(scratch,'footprint-runner');
  execFileSync('clang',['-isysroot','/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk','-O2','-Wall','-Wextra','-framework','JavaScriptCore',join(root,'Loon/Development/SpotifyMobileMemory20261114/footprint-runner.c'),'-o',binary],{stdio:'pipe'});
  const report={schema:1,recordedAt:new Date().toISOString(),scope:'Current maintained mobile runtimes in an owned desktop JavaScriptCore process; synthetic network only',host:{platform:platform(),arch:arch()},nativeIOSAcceptance:false,limitBytesExclusive:50000000,concurrency:1,method:'kernel peak footprint and resident size; fresh VM per invocation; repeated 1 or 20 times; two trials',runtimeHashes:{},runs:[]};
  for(const client of ['Loon','Surge']) {
    const path=join(root,'build/current-runtime/runtime',client,'script/SpotifyLyrics.js'),runtime=readFileSync(path,'utf8');report.runtimeHashes[client]=sha(Buffer.from(runtime));
    for(const mode of ['standard','compact'])for(const fixture of cases) {
      const expected=await oracle(makeHarness(fixture,mode,fixtures),runtime,fixture,fixtures);
      if(!expected.calls)throw Error('Measurement fixture did not exercise translation: '+fixture.name);
      const harness=join(scratch,'host.js');writeFileSync(harness,makeHarness(fixture,mode,fixtures,expected));
      for(const repeats of [1,20])for(const trial of [1,2]) {
        const measured=JSON.parse(execFileSync(binary,[harness,path,String(repeats)],{encoding:'utf8',timeout:30000,maxBuffer:20000}));
        report.runs.push({client,mode,scenario:fixture.name,trial,measurement:measured});
      }
      console.log(client+' '+mode+' '+fixture.name+' complete');
    }
  }
  report.summary={processes:report.runs.length,invocations:report.runs.reduce((n,r)=>n+r.measurement.repeats,0),maxFootprintBytes:Math.max(...report.runs.map(r=>r.measurement.peakFootprintBytes)),maxResidentBytes:Math.max(...report.runs.map(r=>r.measurement.peakResidentBytes))};
  report.summary.belowDesktopReference=report.summary.maxFootprintBytes<50000000&&report.summary.maxResidentBytes<50000000;
  mkdirSync(join(root,'evidence'),{recursive:true});writeFileSync(join(root,'evidence/multilingual-memory.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
  if(!report.summary.belowDesktopReference)process.exitCode=1;
} finally {rmSync(scratch,{recursive:true,force:true});}
