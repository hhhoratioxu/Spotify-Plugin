import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
const original=sourceBuffer('795c677b0d115cab5eb8e4f959424d905a98e3ff','Loon/script/SpotifyLyrics.Entry.Mac.js').toString();
const candidate=readFileSync(new URL('./runtime/SpotifyLyrics.Entry.Mac.JSON.Candidate.js',import.meta.url),'utf8');
const hex='e9b099ff35ac4a9ab73e0e14d20b67a6';
const doc=()=>({gid:Buffer.from(hex,'hex').toString('base64'),name:'自写 metadata 夹具',album:{name:'自写测试专辑'},artist:[{name:'独立测试歌手'}],duration:246099,has_lyrics:false});
const encode=d=>Buffer.from(JSON.stringify(d));
function invoke(code,{body=encode(doc()),headers={},requestHeaders={},args={},method='GET',status=200,url='https://spclient.wg.spotify.com/metadata/4/track/'+hex,expectedNoStore=false,subview=false}={}) {
  const done=[],calls=[],store=new Map();let storeReads=0;
  const inputHeaders={'Content-Type':'application/json','Content-Length':String(body.length),'ETag':'fixture-etag','Content-Encoding':'gzip','Digest':'fixture-digest','Last-Modified':'fixture-date','X-Unknown':'keep','Access-Control-Allow-Origin':'https://xpui.app.spotify.com',...headers};
  const before=typeof body==='string'?body:Buffer.from(body);
  const context={$request:{url,method,headers:requestHeaders},$response:{status,headers:{...inputHeaders},body:typeof body==='string'?body:new Uint8Array(body)},$argument:args,
    $done:r=>done.push(r),$persistentStore:{read(k){storeReads++;return store.get(k);},write(v,k){store.set(k,v);}},
    $httpClient:new Proxy({},{get(){calls.push('unexpected-network');throw Error('no network');}}),console:{log(){throw Error('no logging');}}};
  if(subview){const padded=Buffer.concat([Buffer.alloc(9,255),Buffer.from(body),Buffer.alloc(7,255)]);context.$response.body=new Uint8Array(padded.buffer,padded.byteOffset+9,body.length);}
  vm.runInNewContext(code,context,{timeout:1000});assert.equal(done.length,1);assert.deepEqual(calls,[]);
  assert.deepEqual(context.$response.headers,inputHeaders);assert.deepEqual(typeof context.$response.body==='string'?context.$response.body:Buffer.from(context.$response.body),before);
  if(expectedNoStore){assert.equal(storeReads,0);assert.equal(store.size,0);}
  return done[0];
}
const text=out=>typeof out.body==='string'?out.body:out.body?Buffer.from(out.body).toString():undefined;
test('reproduce the existing JSON pass-through and candidate explicit false token patch',()=>{
  assert.equal(invoke(original).body,undefined);
  const out=invoke(candidate,{expectedNoStore:true});assert.equal(JSON.parse(text(out)).has_lyrics,true);
  assert.equal(text(out),JSON.stringify(doc()).replace('"has_lyrics":false','"has_lyrics":true'));
});
test('preserve unknown big integers, escaped strings, nested flags, whitespace and key order byte for byte',()=>{
  const body=' \r\n'+JSON.stringify(doc()).slice(0,-1)+', "future":90071992547409931234567890,"nested":{"has_lyrics":false},"text":"\\u4e2d\\n\\\"x\\\""}\t';
  const out=invoke(candidate,{body,expectedNoStore:true});assert.equal(out.body,body.replace('"has_lyrics":false','"has_lyrics":true'));
});
test('remove stale body validators and retain unrelated headers including CORS',()=>{
  const out=invoke(candidate);for(const key of ['Content-Length','Content-Encoding','ETag','Digest','Last-Modified'])assert.equal(out.headers[key],undefined);
  assert.equal(out.headers['X-Unknown'],'keep');assert.equal(out.headers['Access-Control-Allow-Origin'],'https://xpui.app.spotify.com');assert.equal(out.headers['Cache-Control'],'no-store');
});
for(const value of [true,null,'false',0,undefined])test('do not infer a missing-lyrics flag from '+String(value),()=>{
  const d=doc();if(value===undefined)delete d.has_lyrics;else d.has_lyrics=value;
  assert.equal(invoke(candidate,{body:encode(d)}).body,undefined);
});
for(const mutate of [d=>d.gid=Buffer.alloc(16).toString('base64'),d=>d.gid=hex,d=>d.gid=d.gid.slice(0,-2),d=>d.gid=d.gid.slice(0,21)+'h==',d=>delete d.name,d=>delete d.album,d=>d.artist=[],d=>d.artist=[{}],d=>d.duration=0,d=>d.duration='246099',d=>d.duration=86400001,d=>d.hasLyrics=false,d=>d.restriction=[{}],d=>d.content_access_status={status:'unknown'}])test('incomplete or ambiguous metadata remains unchanged: '+mutate.toString(),()=>{
  const d=doc();mutate(d);assert.equal(invoke(candidate,{body:encode(d)}).body,undefined);
});
for(const args of [{DISCOVER_MISSING:false},{FALLBACK_PROVIDER:'off'},{TARGET_LANGUAGE:'invalid-language'},{FALLBACK_PROVIDER:'unknown-provider'},'DISCOVER_MISSING=false','FALLBACK_PROVIDER=off','TARGET_LANGUAGE=%ZZ'])test('settings fail open without discovery: '+JSON.stringify(args),()=>assert.equal(invoke(candidate,{args}).body,undefined));
test('normal query arguments retain the baseline setting interpretation',()=>assert.equal(JSON.parse(text(invoke(candidate,{args:'DISCOVER_MISSING=true&FALLBACK_PROVIDER=qq'}))).has_lyrics,true));
test('escaped unpaired surrogates in identifying labels remain unchanged',()=>{const d=doc();d.name='bad\ud800';assert.equal(invoke(candidate,{body:encode(d)}).body,undefined);});
test('regional spclient and explicit HTTPS port use the same narrow route',()=>assert.equal(JSON.parse(text(invoke(candidate,{url:'https://gew1-spclient.spotify.com:443/metadata/4/track/'+hex+'?market=TW'}))).has_lyrics,true));
test('a typed subview excludes unrelated leading and trailing buffer bytes',()=>assert.equal(JSON.parse(text(invoke(candidate,{subview:true,expectedNoStore:true}))).has_lyrics,true));
test('the byte limit applies to multibyte text, not just its character count',()=>{const d=doc();d.future='中'.repeat(45000);assert.equal(invoke(candidate,{body:JSON.stringify(d),headers:{'Content-Length':'0'}}).body,undefined);});
test('a valid bounded document near 128KiB still preserves every unrelated byte',()=>{
  const d=doc();d.future='x'.repeat(130000);const body=encode(d);assert.ok(body.length<131072);assert.equal(text(invoke(candidate,{body,expectedNoStore:true})),body.toString().replace('"has_lyrics":false','"has_lyrics":true'));
});
for(const options of [{method:'POST'},{status:401},{status:403},{status:404},{status:429},{status:500},{url:'https://spclient.wg.spotify.com.evil.test/metadata/4/track/'+hex},{url:'https://accounts.spotify.com/metadata/4/track/'+hex},{url:'http://spclient.wg.spotify.com/metadata/4/track/'+hex},{requestHeaders:{'X-VerseLyrics-Internal':'1'}},{headers:{'Content-Type':'text/html'}},{headers:{'content-type':'application/json'}}])test('do not broaden routes, methods, auth errors or header ambiguity: '+JSON.stringify(options),()=>assert.equal(invoke(candidate,options).body,undefined));
for(const body of [encode(doc()).subarray(0,-1),Buffer.from([0xff]),gzipSync(encode(doc())),Buffer.alloc(131073,32),'{"has_lyrics":false,"has_lyrics":true}',JSON.stringify(doc()).slice(0,-1)+',"has_\\u006cyrics":false}',JSON.stringify(doc()).slice(0,-1)+',"nested":{"a":1,"a":2}}',JSON.stringify(doc()).slice(0,-1)+',"nested":'+ '['.repeat(34)+'0'+']'.repeat(34)+'}',JSON.stringify(doc()).slice(0,-1)+',"many":['+'0,'.repeat(32768)+'0]}'])test('malformed, compressed, duplicate or excessive JSON is preserved: '+(typeof body==='string'?body.length:body.byteLength)+' bytes',()=>assert.equal(invoke(candidate,{body}).body,undefined));
test('protobuf metadata continues through the byte-identical original entry',()=>{
  const target=JSON.parse(readFileSync(new URL('../../../history/3.2.2/core/test/fixtures/target-song.json',import.meta.url)));
  const options={body:Buffer.from(target.metadata_base64,'base64'),headers:{'Content-Type':'application/x-protobuf','Content-Encoding':'identity'}};
  assert.deepEqual(Buffer.from(invoke(candidate,options).body),Buffer.from(invoke(original,options).body));
});
test('candidate embeds the original entry bytes and is absent from all install routes',()=>{
  assert.ok(candidate.includes(original));
  const profile=readFileSync(new URL('../../script/SpotifyLyrics.lpx',import.meta.url),'utf8');assert.doesNotMatch(profile,/JSON\.Candidate|SpotifyMacMetadata/);
});
