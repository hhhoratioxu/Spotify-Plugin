import test from 'node:test';
import assert from 'node:assert/strict';
import run,{loadCache,encodeDocument,parseDocument,packLyrics} from '../src/spotify-lyrics.js';
import {nativeTranslation} from './translation-host.mjs';
import {fileURLToPath} from 'node:url';

const id='0000000000000000000001',other='0000000000000000000002';
const slot='VerseLyrics.v1.network',key='VerseLyrics.v1.cache';
const words=['The paper lantern lights the sea.','I walk beside the quiet shore.'];
const doc={lyrics:{syncType:'LINE_SYNCED',provider:'lrclib',providerDisplayName:'Synthetic LRCLIB',language:'en',lines:words.map((words,i)=>({words,startTimeMs:String(1000+i*2000),endTimeMs:'0',syllables:[]})),alternatives:[{language:'zh-CN',lines:['官方甲','官方乙']}]},colors:{background:-10985626,text:-16777216,highlightText:-1}};
function setup({format='json',status=200,env={},owner=id,expired=false}={}){
  const body=Buffer.from(encodeDocument(doc,format)),store=new Map();
  store.set(slot,JSON.stringify([{owner:'existing',track:owner,expires:Date.now()+(expired?-1:10000)}]));
  let reads=0,calls=0;
  const ctx={env:{FALLBACK_PROVIDER:'lrclib',FETCH_ARTWORK_COLOR:false,...env},request:{url:'https://spclient.wg.spotify.com/color-lyrics/v2/track/'+id,headers:new Headers({Accept:format==='json'?'application/json':'application/x-protobuf'})},
    response:{status,headers:new Headers({'Content-Type':format==='json'?'application/json':'application/x-protobuf','Cache-Control':'public, max-age=86400',ETag:'old',Expires:'tomorrow','Last-Modified':'yesterday','X-Test':'preserve'}),arrayBuffer:async()=>{reads++;return body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength);}},
    storage:{get:k=>store.get(k),set:(k,v)=>store.set(k,v),getJSON:k=>store.has(k)?JSON.parse(store.get(k)):null,setJSON:(k,v)=>store.set(k,JSON.stringify(v))},
    http:{get:async()=>{calls++;throw Error('No new network work expected');}}};
  return {ctx,store,body,get reads(){return reads;},get calls(){return calls;}};
}
for(const format of ['json','protobuf'])for(const status of [200,404])test(`${format} ${status}: cold contention completes before reading the original body`,async()=>{
  const x=setup({format,status});
  const result=await run(x.ctx);
  assert.equal(x.reads,0);assert.equal(x.calls,0);assert.equal(result.body,undefined);assert.equal(result.status,undefined);
  assert.equal(result.headers.get('Cache-Control'),'no-store');assert.equal(result.headers.get('X-Test'),'preserve');
  for(const name of ['ETag','Expires','Last-Modified'])assert.equal(result.headers.get(name),null);
  assert.equal(x.store.has(key),false);
  assert.equal(JSON.parse(x.store.get(slot))[0].retired,undefined);
});
for(const format of ['json','protobuf'])test(`${format}: partial warm translations remain available while network admission is busy`,async()=>{
  const x=setup({format}),cache=loadCache(x.ctx);
  cache.put('translations:v1:zh-CN:'+id,{pairs:[[words[0],'紙燈照亮海面。']]});cache.save();
  const result=await run(x.ctx),out=parseDocument(result.body,format==='json'?'application/json':'application/x-protobuf');
  assert.equal(x.reads,1);assert.equal(x.calls,0);assert.deepEqual(out.words,words);assert.equal(out.hasAlternatives,true);
  assert.ok(Buffer.from(result.body).includes(Buffer.from('紙燈照亮海面。')));
});
test('a warm fallback remains available under contention with its real timestamps',async()=>{
  const x=setup({status:404,env:{TRANSLATION_ENABLED:false}}),cache=loadCache(x.ctx);
  cache.put('lyrics:lrclib:'+id,packLyrics(doc));cache.put('palette:v1:'+id,{colors:doc.colors});cache.save();
  const result=await run(x.ctx),out=JSON.parse(Buffer.from(result.body));
  assert.equal(result.status,200);assert.equal(x.calls,0);
  assert.deepEqual(out.lyrics.lines.map(l=>[l.words,l.startTimeMs]),doc.lyrics.lines.map(l=>[l.words,l.startTimeMs]));
});
test('legacy per-line translation caches retain their compatibility under contention',async()=>{
  const x=setup(),cache=loadCache(x.ctx);cache.put('translation:zh-CN:'+words[0],'保留舊譯文');cache.save();
  const result=await run(x.ctx);assert.equal(x.calls,0);assert.ok(Buffer.from(result.body).includes(Buffer.from('保留舊譯文')));
});
test('Unicode-escaped legacy cache keys take the validating reader instead of being dropped',async()=>{
  const x=setup(),cache=loadCache(x.ctx);cache.put('translations:v1:zh-CN:'+id,{pairs:[[words[0],'保留轉義鍵譯文']]});cache.save();
  x.store.set(key,x.store.get(key).replace('translations:v1:','\\u0074ranslations:v1:'));
  const result=await run(x.ctx);assert.equal(x.calls,0);assert.ok(Buffer.from(result.body).includes(Buffer.from('保留轉義鍵譯文')));
});
test('cache-only processing does not retire an unrelated active network owner',async()=>{
  const x=setup({owner:other,env:{NETWORK_MODE:'cache-only'}});await run(x.ctx);
  assert.equal(x.reads,1);assert.equal(x.calls,0);assert.equal(JSON.parse(x.store.get(slot))[0].retired,undefined);
});
test('disabled fallback preserves an upstream 404 and its headers even during contention',async()=>{
  const x=setup({status:404,owner:other,env:{FALLBACK_PROVIDER:'off'}}),result=await run(x.ctx);
  assert.equal(x.calls,0);assert.deepEqual(Buffer.from(result.body),x.body);
  assert.equal(x.ctx.response.headers.get('Cache-Control'),'public, max-age=86400');
  assert.equal(JSON.parse(x.store.get(slot))[0].retired,undefined);
});
test('a cold different-track contender retires only the existing owner and never starts HTTP',async()=>{
  const x=setup({owner:other});await run(x.ctx);assert.equal(x.reads,0);assert.equal(x.calls,0);
  const rows=JSON.parse(x.store.get(slot));assert.equal(rows.length,1);assert.equal(rows[0].owner,'existing');assert.equal(rows[0].retired,true);
});
test('an expired owner cannot block ordinary processing',async()=>{
  const x=setup({expired:true,env:{TRANSLATION_ENABLED:false}});const result=await run(x.ctx);
  assert.equal(x.reads,1);assert.deepEqual(Buffer.from(result.body),x.body);assert.equal(x.calls,0);
});
test('an owner settling during the cache probe does not leak a newly acquired lease',async()=>{
  const x=setup({env:{TRANSLATION_ENABLED:false}}),read=x.ctx.storage.get;
  x.ctx.storage.get=k=>{if(k===key)x.store.set(slot,'[]');return read(k);};
  const result=await run(x.ctx);assert.equal(x.reads,1);assert.deepEqual(Buffer.from(result.body),x.body);
  assert.deepEqual(JSON.parse(x.store.get(slot)),[]);
});
test('malformed or expired cached rows do not permit body decoding during cold contention',async()=>{
  const x=setup();x.store.set(key,JSON.stringify({entries:[{key:'translations:v1:zh-CN:'+id,value:{pairs:[[words[0],'過期']]},expires:Date.now()-1}],cooldowns:{}}));
  await run(x.ctx);assert.equal(x.reads,0);assert.equal(x.calls,0);
});
test('an unrelated cached song cannot make cold contention decode the body',async()=>{
  const x=setup(),cache=loadCache(x.ctx);cache.put('translations:v1:zh-CN:'+other,{pairs:[[words[0],'其他歌曲']]});cache.save();
  await run(x.ctx);assert.equal(x.reads,0);assert.equal(x.calls,0);
});
for(const path of ['metadata/4/track/'+'0'.repeat(32),'extended-metadata/v0/extended-metadata','bootstrap/v1/bootstrap','user-customization-service/v1/customize','v1/customize'])test(`startup JSON ${path}: the existing core is a proven no-op, so Loon can omit the body script`,async()=>{
  const x=setup();x.ctx.request.url='https://spclient.wg.spotify.com/'+path;
  const result=await run(x.ctx);assert.deepEqual(Buffer.from(result.body),x.body);assert.equal(result.headers,undefined);assert.equal(result.status,undefined);assert.equal(x.calls,0);assert.equal(x.store.has(key),false);
});

const stage=fileURLToPath(new URL('../build/current-runtime/',import.meta.url));
for(const client of ['Loon','Surge','Shadowrocket','QuantumultX','Egern','Mac'])for(const format of ['json','protobuf'])test(`${client} ${format}: staged native busy response preserves original lyrics, official translations and HTTP status`,async()=>{
  const body=Buffer.from(encodeDocument(doc,format)),store=new Map([[slot,JSON.stringify([{owner:'existing',track:id,expires:Date.now()+10000}])]]);
  const output=await nativeTranslation(client,{stage,body,format,store,sourceReply:()=>{throw Error('Busy response must not request anything');}});
  assert.deepEqual(output.bytes,body);assert.equal(output.done,1);assert.equal(output.calls.length,0);assert.equal(output.active,0);assert.equal(output.timers.length,0);assert.equal(output.result?.status,undefined);
  assert.equal(store.has(key),false);
});
for(const client of ['Loon','Surge','Mac'])for(const format of ['json','protobuf'])for(const sameTrack of [true,false])test(`${client} ${format}: overlapping ${sameTrack?'same':'different'} track settles its original callback and recovers on retry`,async()=>{
  const body=Buffer.from(encodeDocument(doc,format)),store=new Map();
  let settle,started,finished=false;
  const ready=new Promise(resolve=>started=resolve);
  const first=nativeTranslation(client,{stage,body,format,store,sourceReply:()=>new Promise(resolve=>{settle=resolve;started();})}).then(value=>{finished=true;return value;});
  await ready;
  let second;
  try {
    second=await nativeTranslation(client,{stage,body,format,store,track:sameTrack?id:other,sourceReply:()=>{throw Error('Duplicate pending transport');}});
    assert.equal(finished,false);assert.deepEqual(second.bytes,body);assert.equal(second.calls.length,0);assert.equal(second.done,1);
    const owners=JSON.parse(store.get(slot));assert.equal(owners.length,1);assert.equal(owners[0].retired===true,!sameTrack);
  }finally{settle({body:JSON.stringify(['紙燈照亮海面。','沿著安靜的岸邊走。'])});}
  const original=await first;
  assert.equal(original.calls.length,1);assert.equal(original.active,0);assert.equal(original.done,1);
  assert.deepEqual(JSON.parse(store.get(slot)),[]);
  const retry=await nativeTranslation(client,{stage,body,format,store,track:sameTrack?id:other,sourceReply:async()=>({body:JSON.stringify(['紙燈照亮海面。','沿著安靜的岸邊走。'])})});
  assert.equal(retry.done,1);assert.equal(retry.calls.length,sameTrack?0:1);assert.ok(retry.bytes.includes(Buffer.from('紙燈照亮海面。')));
});
