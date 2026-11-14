import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
const manifest=JSON.parse(readFileSync(new URL('evidence/observer-artifacts.json',import.meta.url)));
const scripts=Object.fromEntries(manifest.files.filter(f=>f.kind!=='profile').map(f=>[f.kind,readFileSync(new URL(f.path,import.meta.url),'utf8')]));
const hex='e9b099ff35ac4a9ab73e0e14d20b67a6';
const metadata=()=>({gid:Buffer.from(hex,'hex').toString('base64'),name:'PRIVATE_FIXTURE_NAME',album:{name:'PRIVATE_FIXTURE_ALBUM'},artist:[{name:'PRIVATE_FIXTURE_ARTIST'}],duration:246099,has_lyrics:false});
function invoke({kind='body',body=Buffer.from(JSON.stringify(metadata())),url='https://spclient.wg.spotify.com/metadata/4/track/'+hex+'?sensitive=PRIVATE_FIXTURE_QUERY',type='application/json',status=200,logThrows=false}={}){
  const logs=[],done=[],input=typeof body==='string'?body:new Uint8Array(body),before=typeof input==='string'?input:input.slice();
  const context={$request:{method:'GET',url,headers:{Authorization:'PRIVATE_FIXTURE_AUTH',Cookie:'PRIVATE_FIXTURE_COOKIE'}},$response:{status,headers:{'Content-Type':type,'Set-Cookie':'PRIVATE_FIXTURE_RESPONSE_COOKIE'},body:input},
    $persistentStore:new Proxy({},{get(){throw Error('no storage');}}),$httpClient:new Proxy({},{get(){throw Error('no network');}}),console:{log(line){if(logThrows)throw Error('fixture log failure');logs.push(line);}},$done:r=>done.push(r)};
  new vm.Script(scripts[kind]).runInNewContext(context,{timeout:1000});assert.equal(done.length,1);assert.deepEqual(JSON.parse(JSON.stringify(done[0])),{});assert.deepEqual(context.$response.body,before);
  for(const line of logs){assert.ok(line.length<=2048);assert.doesNotMatch(line,/PRIVATE_FIXTURE|Bearer|Authorization|Cookie|spotify:track:|http:/);}
  return logs.map(line=>JSON.parse(line.slice('SpotifyLyricsMeta '.length)));
}
test('read-only observer summarizes schema/identity without logging any source values',()=>{
  const [event]=invoke();assert.equal(event.inspection,'json');assert.equal(event.flag,'false');assert.equal(event.gidFormat,'base64');assert.equal(event.identityMatches,true);assert.equal(event.candidateWouldPatch,true);assert.equal(event.namePresent,true);
});
test('actual-style hex gid is observed without claiming the canonical base64 candidate applies',()=>{const d=metadata();d.gid=hex;const [event]=invoke({body:Buffer.from(JSON.stringify(d))});assert.equal(event.gidFormat,'hex');assert.equal(event.identityMatches,true);assert.equal(event.candidateWouldPatch,false);});
test('metadata default/alias omission remains distinguishable from explicit false',()=>{const d=metadata();delete d.has_lyrics;d.hasLyrics=true;const [event]=invoke({body:Buffer.from(JSON.stringify(d))});assert.equal(event.flag,'missing');assert.equal(event.candidateWouldPatch,false);});
test('prerecorded protobuf metadata is summarized by top-level bytes, never decoded names',()=>{
  const target=JSON.parse(readFileSync(new URL('../../../history/3.2.2/core/test/fixtures/target-song.json',import.meta.url)));const [event]=invoke({body:Buffer.from(target.metadata_base64,'base64'),type:'application/x-protobuf'});assert.equal(event.inspection,'protobuf');assert.equal(event.identityMatches,true);assert.equal(event.flag,'missing');assert.equal(event.candidateWouldPatch,false);
});
test('a protobuf flag with the wrong wire type is not reported as a valid omission',()=>{
  const [event]=invoke({type:'application/x-protobuf',body:Buffer.concat([Buffer.from([10,16]),Buffer.from(hex,'hex'),Buffer.from([146,1,0])])});assert.equal(event.flag,'other');
});
for(const body of [Buffer.from([0xff]),Buffer.alloc(131073),Buffer.from('{"gid":1,"gid":2}')])test('invalid/oversize data has a bounded diagnostic and unchanged native response',()=>{const [event]=invoke({body});assert.ok(['invalid','over-limit'].includes(event.inspection));assert.equal(event.candidateWouldPatch,false);});
test('header-only execution never touches the body or applies candidate logic',()=>{const [event]=invoke({kind:'header',body:Buffer.from(JSON.stringify(metadata())),status:403});assert.equal(event.inspection,'not-read');assert.equal(event.bytes,-1);assert.equal(event.status,403);});
test('lyrics route records only the request response status, not lyric text',()=>{const [event]=invoke({kind:'header',url:'https://spclient.wg.spotify.com/color-lyrics/v2/track/76XUZSb13QUuj1HECY4Hvo?format=json',body:Buffer.from('PRIVATE_FIXTURE_LYRICS'),status:404});assert.equal(event.route,'lyrics');assert.equal(event.inspection,'not-read');assert.equal(event.status,404);});
test('other tracks/domains never produce a log',()=>{for(const url of ['https://accounts.spotify.com/authorize','https://spclient.wg.spotify.com/metadata/4/track/'+'0'.repeat(32),'https://spclient.wg.spotify.com.evil.test/metadata/4/track/'+hex])assert.deepEqual(invoke({url}),[]);});
test('logging failure cannot prevent pass-through or trigger duplicate completion',()=>assert.deepEqual(invoke({logThrows:true}),[]));
test('the three native rules select body only within the original size/status guard',()=>{
  const baseline=sourceBuffer('10049053ce86bd992e3ebb6511ffb28312ba86fb','Surge/Development/VerseLyrics322/loon-rewrite.test.mjs').toString();
  const source=baseline.slice(baseline.indexOf('function condition('),baseline.indexOf('function values('));const condition=vm.runInNewContext(source+'\ncondition',{assert});
  const profile=readFileSync(new URL('MetadataObserveMac.lpx',import.meta.url),'utf8'),rules=profile.split('\n').filter(l=>l.startsWith('response if '));assert.equal(rules.length,3);assert.doesNotMatch(profile,/^request if |\[Rewrite\]|\[Argument\]/m);
  function select({status=200,length=null,url='https://spclient.wg.spotify.com/metadata/4/track/'+hex,internal=null,method='GET'}={}){
    return rules.find(line=>condition(line.slice(12,line.indexOf(' then ')),key=>({url,'request.method':method,'response.status':status,"response.header['Content-Length']":length,"request.header['x-verselyrics-internal']":internal})[key]??null));
  }
  assert.match(select(),/requires_body=true/);for(const status of [401,403,404,429,500])assert.doesNotMatch(select({status}),/requires_body=true/);
  for(const length of ['131073','262144','invalid'])assert.doesNotMatch(select({length}),/requires_body=true/);
  for(const options of [{internal:'1'},{method:'POST'},{url:'https://spclient.wg.spotify.com/metadata/4/track/'+'0'.repeat(32)}])assert.equal(select(options),undefined);
});
