import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {makeFixtures,makeHarness,oracle} from '../SpotifyMobileMemory20261114/fixtures.mjs';
const here=fileURLToPath(new URL('.',import.meta.url)),repo=fileURLToPath(new URL('../../../',import.meta.url));
const pin='10049053ce86bd992e3ebb6511ffb28312ba86fb',macPin='795c677b0d115cab5eb8e4f959424d905a98e3ff';
const out=join(here,'runtime');mkdirSync(join(out,'data'),{recursive:true});
const scratch=mkdtempSync(join(tmpdir(),'verselyrics-native-fixtures-'));
const git=(rev,path)=>sourceBuffer(rev,path);
try{
  writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
  for(const name of ['core/spotify-lyrics.js','lyric-startup-fixture.mjs','startup-fixtures.mjs']){const p=join(scratch,name);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,git(pin,'Surge/Development/VerseLyrics322/'+name));}
  const fixtures=await makeFixtures(pathToFileURL(scratch+'/'));
  const runtimes={mobile:{main:git(pin,'Loon/script/SpotifyLyrics.js').toString(),entry:git(pin,'Loon/script/SpotifyLyrics.Entry.js').toString()},macos:{main:git(macPin,'Loon/script/SpotifyLyrics.Mac.js').toString(),entry:git(macPin,'Loon/script/SpotifyLyrics.Entry.Mac.js').toString()}};
  const chosen=fixtures.cases;
  for(let i=0;i<chosen.length;i++){
    const f=chosen[i],expected={};
    for(const variant of ['mobile','macos'])for(const mode of ['standard','compact'])expected[variant+'-'+mode]=await oracle(makeHarness(f,mode,fixtures),runtimes[variant][f.entry?'entry':'main'],f,fixtures);
    writeFileSync(join(out,'data',i+'.json'),JSON.stringify({index:i,name:f.name,body:Buffer.from(f.body).toString('base64'),store:[...f.store],type:f.type,status:f.status,url:f.url||'https://spclient.wg.spotify.com/color-lyrics/v2/track/0000000000000000000001',entry:!!f.entry,failure:!!f.failure,oversizedService:!!f.oversizedService,expected}));
  }
  const nonce=existsSync(join(out,'manifest.json'))?JSON.parse(readFileSync(join(out,'manifest.json'),'utf8')).nonce:randomBytes(5).toString('hex'),path='/verselyrics-native-'+nonce;
  const canary=`$done({headers:{...$response.headers,"X-VerseLyrics-Memory":"canary-ok"}});\n`;
  writeFileSync(join(out,'canary.js'),canary);
  for(const variant of ['mobile','macos']){
    const textCodec=readFileSync(join(scratch,'core/spotify-lyrics.js'),'utf8').match(/^function text\([^]*?^}/m)[0];
    const driver=`(function(finish,native,origin){\nconst LIMIT=524288;let TEXT_UNITS;\n`+
      // Self-written test data only. Production storage is never accessed.
      fixtures.codecs+textCodec+'\n'+readFileSync(new URL('./driver-body.js',import.meta.url),'utf8')
        .replace('__VARIANT__',JSON.stringify(variant)).replace('__CASE_COUNT__',String(chosen.length))
        .replace('/*__MAIN__*/',()=>runtimes[variant].main).replace('/*__ENTRY__*/',()=>runtimes[variant].entry)+'\n})($done,$httpClient,typeof $response==="undefined"?{headers:{}}:$response);\n';
    if(!driver.includes(runtimes[variant].main)||!driver.includes(runtimes[variant].entry))throw Error('Published runtime bytes were not preserved');
    try{new vm.Script(driver);}catch(e){throw Error('Fixture bridge syntax: '+e.message);}
    writeFileSync(join(out,variant+'.js'),driver);
  }
  const profile='#!name = VerseLyrics 原生内存测试（临时）\n#!desc = 仅在手动运行时使用自写夹具；不读账号、凭据或原有歌词缓存。测试后停用。\n#!author = Horatio\n#!system = macOS\n#!date = 2026-11-14\n\n[Script]\n'+['mobile','macos'].map(kind=>'generic then script("http://127.0.0.1:18766/'+kind+'.js?v='+createHash('sha256').update(readFileSync(join(out,kind+'.js'))).digest('hex').slice(0,12)+'") with tag="VerseLyrics Native Memory '+kind+'", timeout=120').join('\n')+'\n';
  writeFileSync(join(out,'MemoryTest.lpx'),profile);
  writeFileSync(join(out,'manifest.json'),JSON.stringify({date:'2026-11-14',pin,macPin,nonce,path,cases:chosen.map(f=>f.name),sourceHashes:Object.fromEntries(Object.entries(runtimes).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([a,b])=>[a,createHash('sha256').update(b).digest('hex')]))])),scope:'test-only HTTP response bridge in the actual Loon host; extra fixture and result transports add overhead'},null,2)+'\n');
  console.log(JSON.stringify({path,cases:chosen.length,productionStorageAccessed:false}));
}finally{rmSync(scratch,{recursive:true,force:true});}
