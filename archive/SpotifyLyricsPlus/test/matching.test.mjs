import test from 'node:test';
import assert from 'node:assert/strict';
import * as candidate from '../test-runtime/source-core.js';
import * as historical from '../history/3.2.2/core/spotify-lyrics.js';
import {meta,KEY,invoke,reply,seedStore,clients,words} from './host.mjs';
const row={id:1,...meta};
test('same-album ambiguity is reproduced in 3.2.2 and rejected by the candidate',()=>{
  const records=[{...row,duration:179},{...row,id:2,duration:181}];
  assert.equal(historical.sourceCandidates(meta,records,r=>r).length,2);
  assert.deepEqual(candidate.sourceCandidates(meta,records,r=>r),[]);
  assert.deepEqual(candidate.sourceCandidates(meta,[row,{...row,id:2}],r=>r),[]);
  assert.deepEqual(candidate.sourceCandidates(meta,[row,{...row}],r=>r),[row]);
});
test('identical source lyric evidence may collapse, conflicting evidence never does',()=>{
  const records=[{...row,id:1,lyric:'original'},{...row,id:2,lyric:'original'}],same=(a,b)=>a.lyric===b.lyric&&a.duration===b.duration;
  assert.equal(candidate.sourceCandidates(meta,records,r=>r,same).length,1);
  records[1].lyric='conflicting';assert.deepEqual(candidate.sourceCandidates(meta,records,r=>r,same),[]);
});
for(const version of ['Live','Remix','Cover','Instrumental','Acoustic','Demo','现场','翻唱','ライブ','リミックス','カバー','라이브','리믹스','커버'])test('version stays significant: '+version,()=>{
  assert.deepEqual(candidate.sourceCandidates(meta,[{...row,title:meta.title+' ('+version+')'}],r=>r),[]);
  assert.deepEqual(candidate.sourceCandidates({...meta,album:'Different'},[{...row,album:version}],r=>r),[]);
});
for(const delta of [{artists:['Other Singer']},{artists:['Ada North','Extra Artist']},{title:'Another Lantern'},{duration:183},{duration:NaN},{artists:[]}])test('identity mismatch rejected: '+JSON.stringify(delta),()=>{
  assert.deepEqual(candidate.sourceCandidates(meta,[{...row,...delta}],r=>r),[]);
});
for(const [title,source] of [['風中的紙燈','风中的纸灯'],['ＡＢＣ','ABC'],['紙の灯籠','紙の灯籠'],['종이 등불','종이 등불']])test('bounded multilingual normalization: '+title,()=>{
  assert.equal(candidate.sourceCandidates({...meta,title},[{...row,title:source}],r=>r).length,1);
});
test('romanization and unspecified translated aliases are never guessed',()=>{
  for(const title of ['Kami no tourou','종이 등불','Paper Lantern'])assert.equal(candidate.sourceCandidates({...meta,title:'紙の灯籠'},[{...row,title}],r=>r).length,0);
});
test('only the first ten search records can be accepted',()=>{
  const wrong=Array.from({length:10},(_,i)=>({...row,id:i+5,title:'Other '+i}));
  assert.equal(candidate.sourceCandidates(meta,[...wrong,row],r=>r).length,0);
  assert.equal(candidate.sourceCandidates(meta,[...wrong.slice(0,9),row],r=>r).length,1);
});
test('unvalidated full-document cache return is reproduced and fixed',()=>{
  function state(module,key){const storage=new Map(),ctx={env:{},storage:{get:k=>storage.get(k),set:(k,v)=>storage.set(k,v)}};return{settings:{provider:'qq'},cache:module.loadCache(ctx)};}
  const bad={lyrics:{provider:'untrusted',syncType:'LINE_SYNCED',lines:[{words:'Invalid cache',startTimeMs:'NaN'}]}};
  const before=state(historical);before.cache.put('lyrics:qq:'+meta.id,bad);
  assert.equal(historical.cachedBackup(before,meta.id),bad);
  for(const doc of [bad,{...bad,matchingRevision:9,verifiedDuration:180}]){const after=state(candidate);after.cache.put('lyrics:qq:'+meta.id,doc);assert.equal(candidate.cachedBackup(after,meta.id),undefined);}
});
for(const times of [[-1],[NaN],[1800000],[3000,1000]])test('invalid source timeline rejected: '+JSON.stringify(times),()=>{
  const doc={lyrics:{lines:times.map(t=>({startTimeMs:String(t),words:'Original',syllables:[]}))}};
  assert.equal(candidate.validTimeline(doc,180),false);
});
test('real line times remain exact; no syllables are synthesized from enhanced LRC',()=>{
  assert.deepEqual(candidate.lrc('[offset:-100]\n[00:01.20][00:03.40]A <00:01.20>self written line').map(l=>[l.startTimeMs,l.syllables]),[['1100',[]],['3300',[]]]);
});
for(const client of clients)test(`${client}: NetEase POST requests ten records, with native timeout units`,async()=>{
  const out=await invoke(client,{network:u=>reply('netease',u)}),search=out.calls[0];
  assert.equal(new URLSearchParams(search.options.body).get('limit'),'10');
  if(client==='Loon')assert.ok(search.options.timeout>=1&&search.options.timeout<=2500);
  if(client==='Surge')assert.ok(search.options.timeout>0&&search.options.timeout<=2.5);
});
for(const host of ['spclient.wg.spotify.com','gew1-spclient.spotify.com','gae2-spclient.spotify.com:443'])test('spclient host variant: '+host,async()=>{
  const out=await invoke('Loon',{host,network:u=>reply('netease',u)});assert.deepEqual(candidate.parseDocument(out.bytes,'application/json').words,words);
});
test('public metadata lookup never creates an authenticated Spotify API request',async()=>{
  const fake='DO_NOT_FORWARD_FAKE_ONLY',out=await invoke('Loon',{store:new Map(),requestHeaders:{Authorization:'Bearer '+fake,Cookie:fake,'client-token':fake},network:(u,o)=>{
    assert.ok(u.startsWith('https://open.spotify.com/embed/track/'));assert.ok(!JSON.stringify(o).includes(fake));return {status:404,body:'unavailable'};
  }});
  assert.equal(out.calls.length,1);assert.equal(out.bytes.toString(),'missing');assert.ok(!JSON.stringify([...out.store]).includes(fake));
});
test('cache-only mode performs no request on an empty lyric cache',async()=>{
  const out=await invoke('Loon',{env:{NETWORK_MODE:'cache-only'}});assert.equal(out.calls.length,0);assert.equal(out.bytes.toString(),'missing');
});
