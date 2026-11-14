import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {strictDebugWrap} from './strict-debug-wrap.mjs';
const core=sourceBuffer('795c677b0d115cab5eb8e4f959424d905a98e3ff','Loon/script/SpotifyLyrics.Entry.Mac.js').toString();
const uri='spotify:track:76XUZSb13QUuj1HECY4Hvo';
const vi=value=>{const out=[];do{out.push((value&127)|(value>127?128:0));value=Math.floor(value/128);}while(value);return Buffer.from(out);};
const bin=(n,b)=>Buffer.concat([vi(n*8+2),vi(b.length),b]),txt=(n,s)=>bin(n,Buffer.from(s));
const track=value=>bin(3,bin(7,Buffer.concat([txt(1,uri),bin(3,Buffer.concat([txt(1,'has_lyrics'),txt(2,value)])),txt(91,'PRIVATE_FIXTURE_BODY')])));
function run({script=core,body=track('false'),input,postMode='double',type='application/protobuf',url='https://spclient.wg.spotify.com/connect-state/v1/devices/PRIVATE_FIXTURE_DEVICE_12345?private=PRIVATE_FIXTURE_QUERY'}={}){
  const outputs=[],events=[];
  new vm.Script(strictDebugWrap(script,'entry')).runInNewContext({
    $request:{url,method:url.includes('/metadata/4/')?'GET':'PUT',headers:{Authorization:'PRIVATE_FIXTURE_AUTH',Cookie:'PRIVATE_FIXTURE_COOKIE'}},
    $response:{status:200,body:input===undefined?new Uint8Array(body):input,headers:{'Content-Type':type,'X-Private':'PRIVATE_FIXTURE_HEADER'}},$argument:{},$persistentStore:{read(){},write(){return true;}},console:{log(){throw Error('No diagnostic console output');}},$done:v=>outputs.push(v),
    $httpClient:{get(){throw Error('Entry must stay local');},post(o,cb){assert.equal(o.url,'http://127.0.0.1:18765/events');assert.equal(o.timeout,300);assert.equal(o.node,'DIRECT');assert.ok(o.body.length<4096);assert.doesNotMatch(o.body,/PRIVATE_FIXTURE|https?:|Bearer|Cookie|Authorization|spotify:track:|protobuf|application\/|root\.fields|metadata\.\d/);const event=JSON.parse(o.body);assert.deepEqual(Object.keys(event).sort(),['lyricsFlags','pair','publicTargetMatched','route','stage']);assert.equal(typeof event.publicTargetMatched,'boolean');assert.ok(event.lyricsFlags.every(v=>typeof v==='boolean'||['omitted','unknown'].includes(v)));assert.match(event.pair,/^[0-9a-f]{16}$/);events.push(event);if(postMode==='throw')throw Error('fixture transport failure');cb(postMode==='error'?'fixture unavailable':null,{status:204},'');if(postMode==='double')cb(null,{status:204},'');}}
  },{timeout:1000});
  assert.equal(outputs.length,1);assert.equal(events.length,2);assert.equal(events[0].pair,events[1].pair);assert.deepEqual(events.map(e=>e.stage),['before','after']);return {output:outputs[0],events};
}
test('strict B actual core pairs false to true and public match without extra data',()=>{
  const result=run();assert.deepEqual(Buffer.from(result.output.body),track('true'));assert.deepEqual(result.events.map(e=>e.lyricsFlags),[[false],[true]]);assert.ok(result.events.every(e=>e.publicTargetMatched&&e.route==='connect-state'));
});
test('strict B preserves already-true behavior',()=>{const result=run({body:track('true')});assert.equal(result.output.body,undefined);assert.ok(result.events.every(e=>e.lyricsFlags[0]===true));});
for(const postMode of ['error','throw','double'])test('report '+postMode+' preserves one completion and original core bytes',()=>assert.deepEqual(Buffer.from(run({postMode}).output.body),track('true')));
test('JSON and malformed structures remain unknown without logging their contents or format',()=>{
  for(const body of [Buffer.from('{"private":"PRIVATE_FIXTURE_BODY","hasLyrics":false}'),Buffer.from([255])]){const result=run({script:'$done({body:$response.body});',body,type:'PRIVATE_FIXTURE_TYPE'});assert.ok(result.events.every(e=>e.lyricsFlags[0]==='unknown'&&e.publicTargetMatched===false));}
});
test('strict B artifacts include exact fixed production cores and unique disposable cache hashes',()=>{
  const m=JSON.parse(readFileSync(new URL('strict/manifest.json',import.meta.url)));assert.equal(m.newFixCandidatesIncluded,false);assert.equal(m.productionCoreChanged,false);assert.equal(m.profileRulesChanged,false);
  for(const item of m.files){const bytes=readFileSync(new URL('strict/'+item.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);if(item.productionSource){const original=sourceBuffer(m.productionMacCommit,'Loon/script/'+item.productionSource);assert.ok(bytes.includes(original));assert.notEqual(item.sha256,item.productionSHA256);assert.equal(createHash('sha256').update(original).digest('hex'),item.productionSHA256);new vm.Script(bytes.toString());}}
});
test('strict B keeps every configuration byte except the three script URL filenames',()=>{
  const original=readFileSync(new URL('DiagnosisMac.lpx',import.meta.url),'utf8'),strict=readFileSync(new URL('strict/DiagnosisMac.lpx',import.meta.url),'utf8');const normalize=s=>s.replace(/script\("http:\/\/127\.0\.0\.1:18765\/[^"/]+\.js"/g,'script("SCRIPT"');assert.equal(normalize(strict),normalize(original));
});
test('Request cache isolation comment has identical behavior to the production script',()=>{
  const m=JSON.parse(readFileSync(new URL('strict/manifest.json',import.meta.url))),item=m.files.find(f=>f.kind==='request');const original=sourceBuffer(m.productionMacCommit,'Loon/script/'+item.productionSource).toString(),code=readFileSync(new URL('strict/'+item.file,import.meta.url),'utf8');
  function request(source){const done=[];new vm.Script(source).runInNewContext({$request:{url:'https://spclient.wg.spotify.com/color-lyrics/v2/track/76XUZSb13QUuj1HECY4Hvo?format=json',method:'GET',headers:{Accept:'application/json',Authorization:'PRIVATE_FIXTURE_AUTH'}},$argument:{},$done:v=>done.push(v)},{timeout:1000});return JSON.parse(JSON.stringify(done));}
  assert.deepEqual(request(code),request(original));
});
test('actual metadata Entry pairs omitted field18 to true without exposing metadata strings',()=>{
  const fixture=JSON.parse(readFileSync(new URL('../../../history/3.2.2/core/test/fixtures/target-song.json',import.meta.url)));
  const body=Buffer.concat([Buffer.from(fixture.metadata_base64,'base64'),txt(91,'PRIVATE_FIXTURE_BODY')]);
  const result=run({body,url:'https://spclient.wg.spotify.com/metadata/4/track/e9b099ff35ac4a9ab73e0e14d20b67a6?private=PRIVATE_FIXTURE_QUERY'});
  assert.ok(result.output.body);assert.deepEqual(result.events.map(e=>e.lyricsFlags),[['omitted'],[true]]);assert.ok(result.events.every(e=>e.publicTargetMatched&&e.route==='metadata'));
});
const metadataURL='https://spclient.wg.spotify.com/metadata/4/track/e9b099ff35ac4a9ab73e0e14d20b67a6?private=PRIVATE_FIXTURE_QUERY';
for(const [name,make] of [
 ['ArrayBuffer',b=>Uint8Array.from(b).buffer],
 ['cross-realm ArrayBuffer',b=>vm.runInNewContext('Uint8Array.from('+JSON.stringify([...b])+').buffer')],
 ['offset DataView',b=>{const a=Buffer.concat([Buffer.alloc(10,255),b,Buffer.alloc(10,255)]);return new DataView(a.buffer,a.byteOffset+10,b.length);}]
])test('wrapper recognizes protobuf '+name+' and preserves original object',()=>{const b=Buffer.concat([Buffer.from([10,16]),Buffer.from('e9b099ff35ac4a9ab73e0e14d20b67a6','hex'),Buffer.from([144,1,0])]);const input=make(b);const r=run({script:'$done({body:$response.body});',input,url:metadataURL});assert.equal(r.output.body,input);assert.ok(r.events.every(e=>e.publicTargetMatched&&e.lyricsFlags[0]===false));});
for(const mode of ['bytes','string','crossRealm'])test('wrapper recognizes metadata JSON '+mode+' without changing its original body',()=>{const text=' {"gid":"6bCZ/zWsSpq3Pg4U0gtnpg==","has_lyrics":false,"name":"PRIVATE_FIXTURE_BODY","unknown":18446744073709551615} ';const input=mode==='string'?text:mode==='bytes'?new Uint8Array(Buffer.from(text)):vm.runInNewContext('Uint8Array.from('+JSON.stringify([...Buffer.from(text)])+').buffer');const r=run({script:'$done({body:$response.body});',input,url:metadataURL,type:'application/json'});assert.equal(r.output.body,input);assert.ok(r.events.every(e=>e.publicTargetMatched&&e.lyricsFlags[0]===false));});
test('actual unchanged production core keeps metadata JSON byte-for-byte while logger recognizes it',()=>{const text=' {"gid":"6bCZ/zWsSpq3Pg4U0gtnpg==","has_lyrics":false,"unknown":18446744073709551615} ';const input=new Uint8Array(Buffer.from(text)),copy=Buffer.from(input);const r=run({input,url:metadataURL,type:'application/json'});assert.equal(r.output.body,undefined);assert.deepEqual(Buffer.from(input),copy);assert.ok(r.events.every(e=>e.publicTargetMatched&&e.lyricsFlags[0]===false));});
test('actual existing player JSON behavior is paired false to true without a new fix candidate',()=>{const body=Buffer.from(JSON.stringify({player_state:{track:{uri,metadata:{has_lyrics:'false',private:'PRIVATE_FIXTURE_BODY'}}}}));const r=run({body,type:'application/json'});assert.deepEqual(r.events.map(e=>e.lyricsFlags),[[false],[true]]);assert.ok(r.events.every(e=>e.publicTargetMatched));assert.equal(JSON.parse(Buffer.from(r.output.body)).player_state.track.metadata.private,'PRIVATE_FIXTURE_BODY');});
const jsonPrefix='{"gid":"6bCZ/zWsSpq3Pg4U0gtnpg==","has_lyrics":false,';
for(const [name,input] of [
 ['truncated JSON',jsonPrefix],
 ['truncated protobuf',Uint8Array.from([10,16,0])],
 ['truncated UTF8',Buffer.concat([Buffer.from(jsonPrefix+'"private":"'),Buffer.from([0xe4,0xb8])])],
 ['surrogate UTF8',Buffer.concat([Buffer.from(jsonPrefix+'"private":"'),Buffer.from([0xed,0xa0,0x80]),Buffer.from('"}')])],
 ['oversize string',' '.repeat(131073)],
 ['oversize ArrayBuffer',new ArrayBuffer(131073)],
 ['oversize view',new Uint8Array(131073)],
 ['duplicate identity','{"gid":"6bCZ/zWsSpq3Pg4U0gtnpg==","gid":"AAAAAAAAAAAAAAAAAAAAAA==","has_lyrics":false}'],
 ['escaped duplicate flag',jsonPrefix+'"has_\\u006cyrics":true}'],
 ['unrelated nested target',JSON.stringify({private:{gid:'6bCZ/zWsSpq3Pg4U0gtnpg==',has_lyrics:false},url:metadataURL})],
 ['unsupported identity type',jsonPrefix+'"gid":{}}'],
 ['unsupported object',{body:'PRIVATE_FIXTURE_BODY',has_lyrics:false}],
 ['empty bytes',new Uint8Array(0)]
])test('wrapper preserves '+name+' and never converts unknown lyrics to false',()=>{const r=run({script:'$done({body:$response.body});',input,url:metadataURL});assert.equal(r.output.body,input);assert.ok(r.events.every(e=>e.publicTargetMatched===true&&e.lyricsFlags.length===1&&e.lyricsFlags[0]==='unknown'));});
test('unsupported output shape leaves host result intact and completes once',()=>{const result=run({script:'$done({body:null,private:"PRIVATE_FIXTURE_BODY"});'});assert.equal(result.output.body,null);assert.equal(result.output.private,'PRIVATE_FIXTURE_BODY');assert.deepEqual(result.events[1].lyricsFlags,['unknown']);});
