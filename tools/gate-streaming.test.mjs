import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {sourceBuffer} from './source-snapshot.mjs';

const scratch=mkdtempSync(join(tmpdir(),'spotify-gate-parity-'));
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
const baseline=sourceBuffer('10049053ce86bd992e3ebb6511ffb28312ba86fb','Surge/Development/VerseLyrics322/core/spotify-lyrics.js').toString();
const maintained=readFileSync(new URL('../src/spotify-lyrics.js',import.meta.url),'utf8');
for(const [name,source] of [['before',baseline],['after',maintained]])writeFileSync(join(scratch,name+'.js'),source);
const before=await import(pathToFileURL(join(scratch,'before.js'))),after=await import(pathToFileURL(join(scratch,'after.js')));
test.after(()=>rmSync(scratch,{recursive:true,force:true}));
const {join:wire,dataField:d,stringField:s,numberField:n}=after;
const scope='ios-feature-lyrics',flag='enable_has_lyrics_check_bypass';
const assignment=(scope,name,value=n(1,0))=>d(3,wire([d(1,wire([s(1,scope),s(2,name)])),d(3,value)]));
function config(kind='off',rows=0){
  const parts=[s(1,'self-written-config'),n(2,1000)];
  for(let i=0;i<rows;i++)parts.push(assignment('unrelated','setting'+i));
  if(kind==='missing')parts.push(assignment(scope,'another-property'));
  else if(kind==='other-scope')parts.push(assignment('other',flag));
  else if(kind==='duplicate-value')parts.push(assignment(scope,flag,wire([n(1,0),n(1,1)])));
  else if(kind==='wrong-value')parts.push(assignment(scope,flag,s(1,'wrong')));
  else if(kind==='wrong-type')parts.push(d(3,wire([d(1,wire([s(1,scope),s(2,flag)])),s(4,'wrong')])));
  else if(kind==='default')parts.push(assignment(scope,flag,new Uint8Array()));
  else parts.push(assignment(scope,flag,n(1,kind==='on'?1:0)));
  if(kind==='duplicate-id')parts.push(s(1,'duplicate'));
  if(kind==='bad-time')parts.push(s(2,'wrong'));
  parts.push(s(98,'opaque🙂尾部'),n(105,42));
  return wire(parts);
}
function envelope(bytes,kind){if(kind==='bootstrap')for(const field of [1,1,1,1,1,2])bytes=d(field,bytes);return bytes;}
function result(fn,bytes,kind){try{const r=fn(bytes,kind);return {...r,body:Buffer.from(r.body).toString('hex')};}catch(error){return {error:error.message};}}
for(const kind of ['customize','bootstrap'])for(const state of ['off','on','missing','other-scope','default','duplicate-value','wrong-value','wrong-type','duplicate-id','bad-time'])test(`streamed ${kind} ${state}: output, protocol metadata and errors match the preserved working core`,()=>{
  const bytes=envelope(config(state,30),kind);assert.deepEqual(result(after.nativeLyricGate,bytes,kind),result(before.nativeLyricGate,bytes,kind));
});
for(const rows of [1,100,1000,3000])for(const state of ['off','on','missing'])test(`streamed ${rows}-assignment ${state}: unknown fields remain byte identical to the original writer`,()=>{
  const bytes=config(state,rows);assert.deepEqual(result(after.nativeLyricGate,bytes,'customize'),result(before.nativeLyricGate,bytes,'customize'));
});
test('700 deterministic malformed/unknown-field mutations preserve original decisions',()=>{
  let seed=812731;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let i=0;i<700;i++){
    const original=config(i%3===0?'on':i%3===1?'off':'missing',i%7),bytes=new Uint8Array(original);
    for(let j=0;j<1+i%3;j++)bytes[random()%bytes.length]=random()&255;
    const candidate=i%5===0?bytes.subarray(0,random()%bytes.length):bytes;
    assert.deepEqual(result(after.nativeLyricGate,candidate,'customize'),result(before.nativeLyricGate,candidate,'customize'),'mutation '+i);
  }
});
test('several matching assignments keep their original order and exact unknown bytes',()=>{
  const bytes=wire([config('off',80),assignment(scope,flag,n(1,1)),s(111,'unknown-between'),assignment(scope,flag,new Uint8Array()),n(112,123456)]);
  const expected=before.nativeLyricGate(bytes),actual=after.nativeLyricGate(bytes);
  assert.equal(actual.matched,3);assert.equal(actual.updated,2);assert.equal(actual.added,0);
  assert.deepEqual(Buffer.from(actual.body),Buffer.from(expected.body));
});
for(const client of ['Loon','Surge','Shadowrocket','QuantumultX'])for(const kind of ['customize','bootstrap'])for(const state of ['off','on','missing'])test(`${client} ${kind} ${state}: compiled startup adapter completes synchronously without HTTP and matches original bytes`,()=>{
  const bytes=envelope(config(state,200),kind),expected=before.nativeLyricGate(bytes,kind),store=new Map();
  const type='application/x-protobuf';let done=0,output;
  const qx=client==='QuantumultX',context={$argument:{DISCOVER_MISSING:true,FALLBACK_PROVIDER:'auto'},$request:{url:'https://spclient.wg.spotify.com/'+(kind==='bootstrap'?'bootstrap/v1/bootstrap':'user-customization-service/v1/customize'),headers:{}},$response:qx?{statusCode:200,headers:{'Content-Type':type},bodyBytes:bytes.buffer}:{status:200,headers:{'Content-Type':type},body:bytes},$done:r=>{done++;output=r;},setTimeout:()=>{throw Error('No timers');},$httpClient:{get:()=>{throw Error('No HTTP');},post:()=>{throw Error('No HTTP');}},$persistentStore:{read:k=>store.get(k),write:(v,k)=>{store.set(k,v);return true;}}};
  if(qx){context.$environment={variables:context.$argument};context.$prefs={valueForKey:k=>store.get(k),setValueForKey:(v,k)=>{store.set(k,v);return true;}};}
  const runtime=readFileSync(new URL('../build/current-runtime/runtime/'+client+'/script/SpotifyLyrics.Entry.js',import.meta.url),'utf8');
  new vm.Script(runtime).runInNewContext(context,{timeout:2000});
  assert.equal(done,1);assert.equal(store.size,0);
  assert.deepEqual(Buffer.from(qx?output.bodyBytes||bytes:output.body||bytes),Buffer.from(expected.body));
});
for(const kind of ['customize','bootstrap'])for(const state of ['off','on','missing'])test(`Egern ${kind} ${state}: native asynchronous entry preserves original protocol output`,async()=>{
  const bytes=envelope(config(state,200),kind),expected=before.nativeLyricGate(bytes,kind),store=new Map();
  const entry=await import(new URL('../build/current-runtime/runtime/Egern/script/SpotifyLyrics/spotify-lyrics-entry.js',import.meta.url));
  const result=await entry.default({env:{DISCOVER_MISSING:true,FALLBACK_PROVIDER:'auto'},request:{url:'https://spclient.wg.spotify.com/'+(kind==='bootstrap'?'bootstrap/v1/bootstrap':'user-customization-service/v1/customize'),headers:new Headers()},response:new Response(bytes,{headers:{'Content-Type':'application/x-protobuf'}}),storage:{get:k=>store.get(k),set:(k,v)=>store.set(k,v),getJSON:()=>null,setJSON:()=>{throw Error('No storage write expected');}}});
  assert.deepEqual(Buffer.from(result?.body||bytes),Buffer.from(expected.body));assert.equal(store.size,0);
});
