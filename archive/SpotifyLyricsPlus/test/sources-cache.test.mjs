import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDocument} from '../src/spotify-lyrics.js';
import {clients,invoke,reply,words,meta,seedStore,KEY} from './host.mjs';
const classify=u=>u.includes('lrclib.net')?'lrclib':u.includes('c.y.qq.com')?'qq':u.includes('music.163.com')?'netease':u.includes('kugou')?'kugou':u.includes('kuwo')?'kuwo':'lyricsovh';
for(const client of clients)for(const available of ['netease','qq','none'])test(`${client}: auto lookup with only ${available} available`,async()=>{
  const out=await invoke(client,{provider:'auto',network:u=>reply(classify(u),u,{found:classify(u)===available})});
  if(available==='none'){assert.equal(out.bytes.toString(),'missing');assert.equal(out.result.status,undefined);assert.equal(new Headers(out.result.headers).get('Cache-Control'),'no-store');}
  else assert.deepEqual(parseDocument(out.bytes,'application/json').words,words);
  assert.ok(out.calls.length<=12);assert.equal(out.maxActive,1);assert.equal(out.done,1);
});
for(const client of clients)for(const language of [
  {title:'風中的紙燈',artists:['測試歌手'],album:'原創專輯'},
  {title:'Paper Lantern',artists:['Ada North'],album:'Quiet Walk'},
  {title:'紙の灯籠',artists:['自作歌手'],album:'自作アルバム'},
  {title:'종이 등불',artists:['시험 가수'],album:'시험 앨범'}
])test(`${client}: source identity uses complete ${language.title} metadata`,async()=>{
  const track={...meta,...language},out=await invoke(client,{store:seedStore(track),network:u=>reply('netease',u,{track})});assert.deepEqual(parseDocument(out.bytes,'application/json').words,words);assert.equal(out.calls.length,2);
});
for(const client of clients)for(const failure of ['timeout','http-503','malformed','timeline'])test(`${client}: ${failure} restores upstream response and creates no success cache`,async()=>{
  const out=await invoke(client,{network:u=>{
    if(failure==='timeout')throw Error('native http timeout');
    if(failure==='http-503')return {status:503,body:'busy'};
    if(failure==='malformed')return {body:'<html>broken</html>'};
    return reply('netease',u,{lyric:'[99:59]A clearly invalid late line'});
  }});
  assert.equal(out.bytes.toString(),'missing');assert.equal(out.result.status,undefined);assert.equal(out.done,1);assert.equal(out.active,0);
  assert.ok(!JSON.parse(out.store.get(KEY)).entries.some(e=>e.key.startsWith('lyrics:')&&e.value.missing!==true));
});
for(const client of clients)test(`${client}: cache hit, 30 day TTL, expiry and refresh`,async()=>{
  const store=seedStore(),begin=Date.now(),first=await invoke(client,{store,network:u=>reply('netease',u)});
  const saved=JSON.parse(store.get(KEY)),entry=saved.entries.find(e=>e.key==='lyrics:netease:'+meta.id);
  assert.ok(entry);assert.ok(entry.expires>=begin+30*86400000);assert.ok(entry.expires<=Date.now()+30*86400000);assert.equal(entry.value.matchingRevision,9);
  const hit=await invoke(client,{store});assert.equal(hit.calls.length,0);assert.deepEqual(hit.bytes,first.bytes);
  entry.expires=Date.now()-1;store.set(KEY,JSON.stringify(saved));
  const fresh=await invoke(client,{store,network:u=>reply('netease',u,{lyric:'[00:02]A self written updated line'})});assert.equal(fresh.calls.length,2);assert.deepEqual(parseDocument(fresh.bytes,'application/json').words,['A self written updated line']);
  assert.ok(store.get(KEY).length<=32000);assert.ok(JSON.parse(store.get(KEY)).entries.length<=64);
});
for(const client of clients)test(`${client}: changed Spotify metadata invalidates an otherwise warm lyric record`,async()=>{
  const store=seedStore();await invoke(client,{store,network:u=>reply('netease',u)});
  const saved=JSON.parse(store.get(KEY)),entry=saved.entries.find(e=>e.key==='meta:'+meta.id);entry.value={...meta,artists:['Different Singer']};store.set(KEY,JSON.stringify(saved));
  const out=await invoke(client,{store,env:{NETWORK_MODE:'cache-only'}});assert.equal(out.calls.length,0);assert.equal(out.bytes.toString(),'missing');
});
for(const client of clients)test(`${client}: ambiguous same-album IDs are rejected by the compiled source path`,async()=>{
  const out=await invoke(client,{network:u=>{
    const r=reply('netease',u),data=JSON.parse(r.body);assert.ok(data.result?.songs);
    data.result.songs.push({...data.result.songs[0],id:202});return {body:JSON.stringify(data)};
  }});assert.equal(out.calls.length,1);assert.equal(out.bytes.toString(),'missing');assert.equal(out.result.status,undefined);
});
for(const client of clients)test(`${client}: malformed full cache record cannot bypass the compiled decoder`,async()=>{
  const store=seedStore(),saved=JSON.parse(store.get(KEY));saved.entries.push({key:'lyrics:netease:'+meta.id,expires:Date.now()+600000,value:{matchingRevision:9,verifiedDuration:180,verifiedIdentity:JSON.stringify([meta.title,meta.album,meta.artists,meta.duration]),lyrics:{provider:'netease',syncType:'LINE_SYNCED',lines:[{startTimeMs:'NaN',words:'INVALID CACHE MUST NOT DISPLAY'}]}}});store.set(KEY,JSON.stringify(saved));
  const out=await invoke(client,{store,env:{NETWORK_MODE:'cache-only'}});assert.equal(out.calls.length,0);assert.equal(out.bytes.toString(),'missing');assert.equal(out.result.status,undefined);
});
for(const client of clients)test(`${client}: original credentials never reach source requests or storage`,async()=>{
  const secret='FAKE_CREDENTIAL_SENTINEL',store=seedStore();
  const out=await invoke(client,{store,requestHeaders:{Authorization:'Bearer '+secret,Cookie:secret,'client-token':secret},network:(u,o)=>{assert.ok(!JSON.stringify(o).includes(secret));return reply('netease',u);}});
  assert.ok(!JSON.stringify([...store]).includes(secret));assert.ok(!out.bytes.includes(Buffer.from(secret)));assert.equal(out.done,1);
});
for(const client of clients)for(const provider of ['auto','qq','netease','lrclib','kugou','kuwo','lyricsovh','off'])test(`${client}: distributed policy denies unreviewed ${provider}`,async()=>{
  const out=await invoke(client,{profile:'dist',provider,requestHeaders:{Authorization:'Bearer FAKE_ONLY'}});assert.equal(out.calls.length,0);assert.equal(out.bytes.toString(),'missing');assert.equal(out.result.status,undefined);assert.equal(out.result.headers,undefined);assert.equal(out.done,1);
});
for(const client of ['Loon','Surge'])for(const format of ['json','protobuf'])test(`${client} ${format}: instrumental source records never inject placeholder lyrics`,async()=>{
  const out=await invoke(client,{format,provider:'lrclib',network:u=>{
    const r=reply('lrclib',u),data=JSON.parse(r.body);
    for(const record of Array.isArray(data)?data:[data])record.instrumental=true;
    return {body:JSON.stringify(data)};
  }});assert.equal(out.bytes.toString(),'missing');assert.equal(out.result.status,undefined);assert.equal(out.calls.length,2);assert.equal(out.done,1);
});
