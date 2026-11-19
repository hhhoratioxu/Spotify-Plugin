import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {baseline,macSource,versionDate,filterEntryJSON,repo,git,files,section,rules,createProfile} from './build-subscription.mjs';
import {relocateProfile,runtimeRelease,runtimeURL} from '../../../tools/runtime-release.mjs';
import {setTranslationDescription} from '../../../tools/translation-description.mjs';
const profile=readFileSync(join(repo,'Loon/script/SpotifyLyrics.lpx'),'utf8');
const manifest=JSON.parse(readFileSync(new URL('./subscription-manifest.json',import.meta.url),'utf8'));
const old=git(macSource,'Loon/script/SpotifyLyrics.lpx').toString();
const mac=git(macSource,'Loon/Development/SpotifyMac20261114/DisplayMac.lpx').toString();
// Reuse the baseline's independent interpreter for the documented conditional
// subset. This is not a claim to run Loon's native configuration parser.
const fixture=git(baseline,'Surge/Development/VerseLyrics322/loon-rewrite.test.mjs').toString();
const interpreter=fixture.slice(fixture.indexOf('function condition('),fixture.indexOf('function values('));
assert.ok(interpreter.includes('function condition('));
const condition=vm.runInNewContext(interpreter+'\ncondition',{assert});
const unGate=line=>line.replace(/^(request|response) if \$\{CLIENT_PLATFORM\} == "(?:mobile|macOS)" && /,'$1 if ');
const paths=['color-lyrics/v2/track/'+'0'.repeat(21)+'1','metadata/4/track/'+'0'.repeat(32),'extended-metadata/v0/extended-metadata','scrollsita/v1/scroll/spotify:track:'+'0'.repeat(21)+'1','user-customization-service/v1/customize','bootstrap/v1/bootstrap','context-resolve/v1/spotify:playlist:test','connect-state/v1/devices/abcdefghijklmnop'];
const defaults={CLIENT_PLATFORM:'mobile',TRANSLATION_ENABLED:true,TARGET_LANGUAGE:'zh-CN',FALLBACK_PROVIDER:'auto',DISCOVER_MISSING:true};
test('the standalone display name is SpotifyLyrics and survives the real subscription builder',()=>{
  assert.equal(profile.split('\n')[0],'#!name = SpotifyLyrics');
  assert.equal(createProfile(manifest.runtimeCommit).split('\n')[0],'#!name = SpotifyLyrics');
});
function select(lines,{mode='mobile',url='https://spclient.wg.spotify.com/'+paths[0],method='GET',status=200,length='20',internal=null,contentType=null,marker=null,env={}}={}){
  const values=k=>{
    if(k==='url')return url;if(k==='request.method')return method;if(k==='response.status')return status;
    if(k==="request.header['x-verselyrics-internal']")return internal;
    if(k==="response.header['Content-Length']")return length;
    if(k==="response.header['Content-Type']")return contentType;
    if(k==="response.header['x-verselyrics']")return marker;
    if(k.startsWith('request.header[')||k.startsWith('response.header['))return null;
    assert.ok(Object.hasOwn(defaults,k));return k==='CLIENT_PLATFORM'?mode:Object.hasOwn(env,k)?env[k]:defaults[k];
  };
  return lines.filter(line=>condition(line.slice(line.indexOf(' if ')+4,line.indexOf(' then ')),values));
}
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
test('mobile retains the original rewrites and scripts with a known no-op JSON startup filter',()=>{
  assert.deepEqual(rules(profile,'Rewrite').map(unGate),rules(old,'Rewrite'));
  assert.deepEqual(rules(profile,'Script').filter(l=>l.includes('CLIENT_PLATFORM} == "mobile"')).map(unGate),rules(filterEntryJSON(relocateProfile(old)),'Script'));
});
for(const contentType of ['application/json','APPLICATION/JSON; charset=UTF-8','application/problem+json'])test(`mobile startup ${contentType}: unsupported JSON metadata/configuration selects no body script`,()=>{
  const noOps=['metadata/4/track/'+'0'.repeat(32),'extended-metadata/v0/extended-metadata','bootstrap/v1/bootstrap','user-customization-service/v1/customize','v1/customize'];
  for(const path of noOps)for(const host of ['spclient.wg.spotify.com','gew1-spclient.spotify.com','gae2-spclient.spotify.com:443']){
    const options={url:'https://'+host+'/'+path+'?fixture=1',contentType};
    assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('response ')),options).length,0);
    assert.equal(select(rules(relocateProfile(old),'Script'),options).length,1,'prove the old entry would have run');
  }
});
for(const contentType of [null,'application/x-protobuf','application/octet-stream'])test(`mobile startup ${contentType}: native binary and unknown content types retain the original routes`,()=>{
  for(const path of paths){const options={url:'https://spclient.wg.spotify.com/'+path,contentType};assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('response ')),options).length,1);}
});
test('supported scroll/player JSON and the actual lyric response still select one mobile script',()=>{
  for(const path of [paths[0],paths[3],paths[6],paths[7]])assert.equal(select(rules(profile,'Script').filter(l=>l.startsWith('response ')),{url:'https://spclient.wg.spotify.com/'+path,contentType:'application/json'}).length,1);
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
test('native response routing preserves original status and size guards for phones',()=>{
  for(const path of paths)for(const status of [200,404,304,401,403,429,500])for(const length of [null,'20','131073','262145']){
    const options={url:'https://spclient.wg.spotify.com/'+path,status,length};
    assert.deepEqual(select(rules(profile,'Script').filter(l=>l.startsWith('response ')),options).map(unGate),select(rules(filterEntryJSON(relocateProfile(old)),'Script'),options));
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
  for(const line of rules(profile,'Script'))assert.match(line,/script\("https:\/\/raw\.githubusercontent\.com\/hhhoratioxu\/SpotifyLyrics\/[0-9a-f]{40}\/Loon\/script\/[^"/]+\.js"/);
  for(const item of files)assert.doesNotMatch(readFileSync(join(repo,'Loon/script/'+item.name),'utf8'),/127\.0\.0\.1:18765|phase:"|cache-probe|\/events/);
});
test('the published profile hash and honest acceptance state match its manifest',()=>{
  assert.equal(Buffer.byteLength(profile),manifest.profile.bytes);assert.equal(createHash('sha256').update(profile).digest('hex'),manifest.profile.sha256);
  assert.equal(manifest.mobileRuntimeChanged,true);assert.equal(manifest.patch,runtimeRelease.patch);assert.equal(manifest.iosPeakAcceptance,'unverified');assert.equal(manifest.macMissingLyricsEntry,'unverified');
});
