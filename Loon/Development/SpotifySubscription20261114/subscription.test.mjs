import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {selectLoonRules as select} from './routing-fixture.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {macSource,versionDate,mobileResponses,repo,git,files,section,rules,createProfile} from './build-subscription.mjs';
import {relocateProfile,runtimeRelease,runtimeURL} from '../../../tools/runtime-release.mjs';
import {setTranslationDescription} from '../../../tools/translation-description.mjs';
const profile=readFileSync(join(repo,'Loon/script/SpotifyLyrics.lpx'),'utf8');
const manifest=JSON.parse(readFileSync(new URL('./subscription-manifest.json',import.meta.url),'utf8'));
const old=git(macSource,'Loon/script/SpotifyLyrics.lpx').toString();
const mac=git(macSource,'Loon/Development/SpotifyMac20261114/DisplayMac.lpx').toString();
const unGate=line=>line.replace(/^(request|response) if \$\{CLIENT_PLATFORM\} == "(?:mobile|macOS)" && /,'$1 if ');
const paths=['color-lyrics/v2/track/'+'0'.repeat(21)+'1','metadata/4/track/'+'0'.repeat(32),'extended-metadata/v0/extended-metadata','scrollsita/v1/scroll/spotify:track:'+'0'.repeat(21)+'1','user-customization-service/v1/customize','bootstrap/v1/bootstrap','context-resolve/v1/spotify:playlist:test','connect-state/v1/devices/abcdefghijklmnop'];
test('the standalone display name is SpotifyLyrics and survives the real subscription builder',()=>{
  assert.equal(profile.split('\n')[0],'#!name = SpotifyLyrics');
  assert.equal(createProfile(manifest.runtimeCommit).split('\n')[0],'#!name = SpotifyLyrics');
});
test('the actual public entry has a reproducible build and a numbered WeatherKit-style description',()=>{
  assert.equal(createProfile(manifest.runtimeCommit),profile);
  assert.match(profile,/^#!date = \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/m);
  assert.equal(profile.split('\n').find(line=>line.startsWith('#!date = ')),'#!date = '+versionDate);
  assert.equal(manifest.versionDate,versionDate);
  const description=profile.split('\n').find(line=>line.startsWith('#!desc = ')).slice(9).split('\\n');
  assert.equal(description[0],'iOS & iPadOS & macOS');
  assert.equal(description.length,8);
  assert.ok(description.slice(1).every((line,i)=>line.startsWith((i+1)+'.')));
  assert.match(description[5],/不同语言的艺人名/);
  assert.match(description[6],/Mac.*无词补全适配/);
  assert.match(description[7],/同一录音/);
});
test('existing settings are preserved and the optional version lookup has no default input',()=>{
  const args=section(profile,'Argument');
  assert.equal(args.split('\n').filter(line=>!line.startsWith('CLIENT_PLATFORM = ')&&!line.startsWith('VERSION_TRACK = ')).join('\n'),section(setTranslationDescription(old),'Argument'));
  assert.match(args,/^CLIENT_PLATFORM = select,"mobile","macOS",type=string/);
  assert.match(args,/^VERSION_TRACK = input,"",type=string/m);
  assert.ok(section(profile,'Script').includes('generic then script("'+runtimeURL('Loon/script/SpotifyLyrics.Versions.js')));
});
test('mobile keeps lyric requests and dedicated startup rewrites; player state keeps the upstream request headers',()=>{
  const rewrites=rules(profile,'Rewrite');
  for(const path of paths) {
    const options={url:'https://spclient.wg.spotify.com/'+path};
    const count=select(rules(old,'Rewrite'),options).length;
    assert.equal(select(rewrites,options).length,[paths[6],paths[7]].includes(path)?0:count);
  }
  assert.deepEqual(rules(profile,'Script').filter(l=>l.includes('CLIENT_PLATFORM} == "mobile"')).map(unGate),rules(mobileResponses(relocateProfile(old)),'Script'));
});
for(const contentType of ['application/json','APPLICATION/JSON; charset=UTF-8','application/problem+json'])test(`mobile startup ${contentType}: unsupported JSON metadata/configuration selects no body script`,()=>{
  const noOps=['extended-metadata/v0/extended-metadata','bootstrap/v1/bootstrap','user-customization-service/v1/customize','v1/customize'];
  for(const path of noOps)for(const host of ['spclient.wg.spotify.com','gew1-spclient.spotify.com','gae2-spclient.spotify.com:443']){
    const options={url:'https://'+host+'/'+path+'?fixture=1',contentType};
    assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('response ')),options).length,0);
    assert.equal(select(rules(relocateProfile(old),'Script'),options).length,1,'prove the old entry would have run');
  }
});
for(const contentType of [null,'application/x-protobuf','application/octet-stream'])test(`mobile startup ${contentType}: native binary and unknown content types retain the original routes`,()=>{
  for(const path of paths){const options={url:'https://spclient.wg.spotify.com/'+path,contentType};assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('response ')),options).length,1);}
});
test('supported track/scroll/player JSON and lyric responses select one mobile script',()=>{
  for(const path of [paths[0],paths[1],paths[3],paths[6],paths[7]])assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('response ')),{url:'https://spclient.wg.spotify.com/'+path,contentType:'application/json'}).length,1);
});
test('mobile discovery disabled selects no entry body VM while normal lyric translation remains available',()=>{
  const responses=rules(profile,'Script').filter(l=>l.startsWith('response ')),env={DISCOVER_MISSING:false};
  for(const path of paths.slice(1))assert.equal(select(responses,{url:'https://spclient.wg.spotify.com/'+path,env}).length,0);
  assert.equal(select(responses,{env}).length,1);
});
test('mobile fallback disabled selects no entry VM and preserves enabled lyric translation',()=>{
  const responses=rules(profile,'Script').filter(l=>l.startsWith('response ')),env={FALLBACK_PROVIDER:'off'};
  for(const path of paths.slice(1))assert.equal(select(responses,{url:'https://spclient.wg.spotify.com/'+path,env}).length,0);
  assert.equal(select(responses,{env}).length,1);
});
test('mobile translation and fallback both disabled select no lyric body VM for 200 or 404',()=>{
  const responses=rules(profile,'Script').filter(l=>l.startsWith('response ')),env={FALLBACK_PROVIDER:'off',TRANSLATION_ENABLED:false};
  for(const status of [200,404])assert.equal(select(responses,{env,status}).length,0);
});
test('mobile translation disabled still selects the original backup path when fallback is enabled',()=>{
  assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('response ')),{env:{TRANSLATION_ENABLED:false}}).length,1);
});
test('already processed mobile responses select no second body VM',()=>{
  for(const path of paths)assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('response ')),{url:'https://spclient.wg.spotify.com/'+path,marker:'3.2.2'}).length,0);
});
test('phone never starts the new Mac request script or loads a Mac runtime',()=>{
  for(const path of paths)for(const host of ['spclient.wg.spotify.com','gew1-spclient.spotify.com','gae2-spclient.spotify.com:443']){
    const url='https://'+host+'/'+path;
    assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('request ')),{url}).length,0);
    const chosen=select(rules(profile,'Script').filter(l=>l.startsWith('response ')),{url});
    assert.equal(chosen.length,1);assert.ok(chosen.every(l=>!l.includes('.Mac.js')));
  }
});
test('mobile batch startup and player state require a small declared identity body',()=>{
  const responses=rules(profile,'Script').filter(l=>l.startsWith('response '));
  for(const path of [paths[2],...paths.slice(4)]) {
    const url='https://spclient.wg.spotify.com/'+path;
    assert.equal(select(responses,{url,length:'32000',encoding:'IDENTITY'}).length,1);
    for(const length of [null,'','32001','120000','-2','1e3','20, 20']) assert.equal(select(responses,{url,length}).length,0);
    for(const headers of [{encoding:'gzip'},{encoding:'br'},{transfer:'chunked'},{contentType:'audio/ogg'},{contentType:'text/html'}]) {
      assert.equal(select(responses,{url,...headers}).length,0);
    }
  }
});
test('mobile exact track, card and lyric routes retain small or lengthless HTTP/2 identity bodies',()=>{
  const responses=rules(profile,'Script').filter(l=>l.startsWith('response '));
  for(const path of [paths[0],paths[1],paths[3]]) {
    const url='https://spclient.wg.spotify.com/'+path;
    for(const length of [null,'20','32000','64000']) assert.equal(select(responses,{url,length}).length,1);
    for(const length of ['64001','262145','123abc']) assert.equal(select(responses,{url,length}).length,0);
    assert.equal(select(responses,{url,encoding:'gzip'}).length,0);
    assert.equal(select(responses,{url,transfer:'chunked'}).length,0);
  }
});
test('mobile lyric 404 takes the header-only path; auth and service errors never enter',()=>{
  const responses=rules(profile,'Script').filter(l=>l.startsWith('response '));
  for(const path of paths) {
    const url='https://spclient.wg.spotify.com/'+path;
    for(const status of [304,401,403,429,500]) assert.equal(select(responses,{url,status}).length,0);
    const missing=select(responses,{url,status:404,length:null});
    if(path!==paths[0]) assert.deepEqual(missing,[]);
    else {
      assert.equal(missing.length,1);
      assert.match(missing[0],/requires_body=false$/);
      assert.equal(select(responses,{url,status:404,env:{FALLBACK_PROVIDER:'off'}}).length,0);
      assert.equal(select(responses,{url,status:404,method:'HEAD'}).length,0);
      assert.match(select(responses,{url,status:200})[0],/requires_body=true, binary_body_mode=true$/);
    }
  }
});
test('Mac selects its own request and exactly one response while native rewrites stay inactive',()=>{
  for(const path of paths)for(const method of ['GET','POST','PUT']){
    const opts={mode:'macOS',method,url:'https://spclient.wg.spotify.com/'+path};
    assert.equal(select(rules(profile,'Rewrite'),opts).length,0);
    assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('request ')),opts).length,1);
    const chosen=select(rules(profile,'Script').filter(l=>l.startsWith('response ')),opts);
    assert.equal(chosen.length,1);assert.ok(chosen[0].includes('.Mac.js'));
  }
});
test('Mac preflight and HEAD avoid all script instances',()=>{for(const method of ['OPTIONS','HEAD','DELETE','PATCH'])assert.equal(select(rules(profile,'Script'),{mode:'macOS',method}).length,0);});
test('internal fetches, unrelated hosts and invalid platform values do not select new scripts',()=>{
  for(const mode of ['mobile','macOS']){
    assert.equal(select(rules(profile,'Script'),{mode,internal:'1'}).length,0);
    for(const url of ['https://accounts.spotify.com/authorize','https://spclient.wg.spotify.com.evil.test/'+paths[0]])assert.equal(select(rules(profile,'Script'),{mode,url}).length,0);
  }
  assert.equal(select(rules(profile,'Script'),{mode:'unknown'}).length,0);
});
test('Mac routes preserve the tested candidate conditions and all native completion/body options',()=>{
  const actual=rules(profile,'Script').filter(l=>l.includes('CLIENT_PLATFORM} == "macOS"')).map(unGate);
  const expected=rules(mac,'Script').map(l=>{for(const item of files)l=l.replace('http://127.0.0.1:18765/'+item.source,runtimeURL('Loon/script/'+item.name));return l;});
  assert.deepEqual(actual,expected);assert.equal(section(profile,'Mitm'),section(old,'Mitm'));
});
test('each real runtime matches its immutable pin and the established Mac transport remains unchanged',()=>{
  for(const item of files){
    const bytes=readFileSync(join(repo,'Loon/script/'+item.name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),runtimeRelease.artifacts.find(a=>a.path==='Loon/script/'+item.name).sha256);
    if(item.name==='SpotifyLyrics.Request.Mac.js')assert.deepEqual(bytes,git(macSource,'Loon/Development/SpotifyMac20261114/runtime/'+item.source));
    new vm.Script(bytes.toString());
  }
});
test('the public install chain contains only immutable public URLs and no local diagnostics',()=>{
  assert.doesNotMatch(profile,/127\.0\.0\.1|localhost|18765|CacheProbe|Debug|observe/);
  for(const line of rules(profile,'Script'))assert.match(line,/script\("https:\/\/raw\.githubusercontent\.com\/hhhoratioxu\/Spotify-Plugin\/[0-9a-f]{40}\/Loon\/script\/[^"/]+\.js"/);
  for(const item of files)assert.doesNotMatch(readFileSync(join(repo,'Loon/script/'+item.name),'utf8'),/127\.0\.0\.1:18765|phase:"|cache-probe|\/events/);
});
test('the published profile hash and honest acceptance state match its manifest',()=>{
  assert.equal(Buffer.byteLength(profile),manifest.profile.bytes);assert.equal(createHash('sha256').update(profile).digest('hex'),manifest.profile.sha256);
  assert.equal(manifest.mobileRuntimeChanged,true);assert.equal(manifest.patch,runtimeRelease.patch);assert.equal(manifest.iosPeakAcceptance,'unverified');assert.equal(manifest.macMissingLyricsEntry,'unverified');
});
