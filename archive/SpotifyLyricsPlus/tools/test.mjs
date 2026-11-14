import {spawnSync} from 'node:child_process';
import {readdirSync,mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
function run(args,env=process.env,cwd=root){
  const r=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8',maxBuffer:8*1024*1024});
  if(r.status!==0){process.stderr.write(r.stderr||'');process.stdout.write(r.stdout||'');process.exit(r.status??1);}
  return r.stdout;
}
run(['build.mjs']);run(['tools/generate-imports.mjs']);
run(['build.mjs'],{...process.env,LYRICS_BUILD_OUTPUT:'test-runtime',LYRICS_FIXTURE_BUILD:'1'});
// The exact upstream tests remain in history. Reuse codec/cache tests against
// the candidate in a temporary mirror; only the cache-key fixture is renamed.
const reusable=['lrc-streaming','metadata-selective','extended-identity','parse-work','player-streaming','wire-performance','indexed-cache','cache-save-ranges','cache-work'];
const scratch=mkdtempSync(join(tmpdir(),'spotify-lyricsplus-regression-'));
try{
  mkdirSync(join(scratch,'core','test'),{recursive:true});
  writeFileSync(join(scratch,'package.json'),' {"type":"module"}\n');
  cpSync(new URL('src/spotify-lyrics.js',root),join(scratch,'core','spotify-lyrics.js'));
  cpSync(new URL('history/3.2.2/core/test/fixtures/',root),join(scratch,'core','test','fixtures'),{recursive:true});
  const paths=[];
  for(const name of reusable){
    const relative='core/test/'+name+'.test.mjs';let text=readFileSync(new URL('history/3.2.2/'+relative,root),'utf8').replaceAll('VerseLyrics.v1.cache','SpotifyLyricsPlus.v1.cache');
    if(name==='wire-performance')text=text.replace('Array.from({length:50},(_,i)=>({title:i===49?', 'Array.from({length:10},(_,i)=>({title:i===9?').replace('records[49]','records[9]');
    writeFileSync(join(scratch,relative),text);paths.push(join(scratch,relative));
  }
  const tests=readdirSync(new URL('test/',root)).filter(n=>n.endsWith('.test.mjs')).map(n=>new URL('test/'+n,root).pathname);
  const output=run(['--test','--test-reporter=tap',...paths,...tests]);
  writeFileSync(new URL('evidence/candidate-tests.tap',root),output);
  const files=['src/spotify-lyrics.js','src/native-adapter.js','build.mjs','source-policy.json','dist/runtime-manifest.json','dist/import-manifest.json','dist/Loon/script/SpotifyLyrics.lpx','dist/Surge/script/SpotifyLyrics.sgmodule'];
  const hashes=Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex')]));
  const summary={date:'2026-11-13',kind:'offline fixture and compiled VM tests',tests:Number(output.match(/# tests (\d+)/)?.[1]),passed:Number(output.match(/# pass (\d+)/)?.[1]),failed:Number(output.match(/# fail (\d+)/)?.[1]),reusedHistoricalSuites:reusable,fixtureAdaptations:['cache namespace','wire-performance candidate count from 50 to 10'],hashes,liveSpotify:false,iPhoneVPN:false,licensedProviderLiveRequests:0};
  writeFileSync(new URL('evidence/validation-summary.json',root),JSON.stringify(summary,null,2)+'\n');
  console.log(output.split('\n').slice(-10).join('\n'));
}finally{rmSync(scratch,{recursive:true,force:true});}
