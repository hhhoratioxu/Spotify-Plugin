import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeDocument,parseDocument} from '../src/spotify-lyrics.js';
import {clients,invoke,words,colors,reply} from './host.mjs';
const languages={zh:'这是原创测试歌词',en:'My original paper lantern',ja:'これは自作の歌詞です',ko:'직접 만든 시험 가사'};
for(const client of clients)for(const format of ['json','protobuf'])for(const [language,words] of Object.entries(languages))for(const syncType of ['LINE_SYNCED','UNSYNCED']){
  test(`${client} ${format} native ${language} ${syncType}: exact original response, zero network`,async()=>{
    const original={lyrics:{provider:'Spotify',providerDisplayName:'Spotify',syncType,language,lines:[{words,startTimeMs:syncType==='UNSYNCED'?'0':'1200',endTimeMs:'3400',syllables:[{words,startTimeMs:'1200'}]}],alternatives:[{language:'zh-CN',lines:['Native translation']}],futureField:'preserve'},colors,futureEnvelope:[1,2,3]};
    const body=format==='json'?Buffer.from(JSON.stringify(original)):Buffer.concat([Buffer.from(encodeDocument(original,format)),Buffer.from([0xa2,0x06,0x03,0xff,0,0xfe])]);
    const out=await invoke(client,{format,body,status:200,headers:{ETag:'original',Expires:'future','Content-Encoding':'gzip'},env:{TRANSLATION_ENABLED:true,REPLACE_UNSYNCED:true,FALLBACK_OFFSET_MS:5000}});
    assert.deepEqual(out.bytes,body);assert.equal(out.calls.length,0);assert.equal(out.done,1);assert.equal(out.result.headers,undefined);
    if(!['Egern','QuantumultX'].includes(client))assert.equal(out.synchronous,true);
  });
}
for(const client of clients)for(const code of [401,403,429,500,503])test(`${client}: access and upstream error ${code} is not a missing lyric`,async()=>{
  const out=await invoke(client,{status:code,body:'upstream error',headers:{'Retry-After':'120'}});assert.equal(out.calls.length,0);assert.equal(out.bytes.toString(),'upstream error');assert.equal(out.result.status,undefined);assert.equal(out.done,1);
});
for(const client of clients)for(const body of [Buffer.from([10,127,1]),Buffer.from([15]),Buffer.from('{bad json'),Buffer.from([31,139,8,0]),Buffer.alloc(262145,65)])test(`${client}: invalid/oversized response is preserved (${body.length} bytes)`,async()=>{
  const out=await invoke(client,{status:200,body,format:'protobuf'});assert.deepEqual(out.bytes,body);assert.equal(out.calls.length,0);assert.equal(out.done,1);
});
for(const client of clients)for(const format of ['json','protobuf'])test(`${client} ${format}: verified fallback uses real line timing and no fabricated word times`,async()=>{
  const out=await invoke(client,{format,network:u=>reply('netease',u)}),doc=parseDocument(out.bytes,format==='json'?'application/json':'application/x-protobuf');
  assert.deepEqual(doc.words,words);assert.equal(doc.unsynced,false);assert.equal(out.calls.length,2);assert.equal(out.done,1);assert.equal(out.active,0);assert.equal(out.maxActive,1);
  if(format==='json')for(const line of JSON.parse(out.bytes).lyrics.lines)assert.deepEqual(line.syllables,[]);
});
for(const client of clients)test(`${client}: duplicate native transport callbacks still complete once`,async()=>{
  const out=await invoke(client,{network:async u=>{await new Promise(r=>setTimeout(r,5));return reply('netease',u);},repeatCallbacks:true});assert.equal(out.done,1);assert.equal(out.active,0);assert.equal(out.calls.length,2);assert.deepEqual(parseDocument(out.bytes,'application/json').words,words);
});
for(const client of clients)test(`${client}: native word-timed JSON preserves every timing and native translation`,async()=>{
  const body=Buffer.from(JSON.stringify({lyrics:{syncType:'SYLLABLE_SYNCED',language:'en',provider:'Spotify',lines:[{startTimeMs:'1000',endTimeMs:'4000',words:'A self written line',syllables:[{startTimeMs:'1000',endTimeMs:'1100',words:'A'},{startTimeMs:'1100',endTimeMs:'2000',words:'self'}]}],alternatives:[{language:'zh',lines:['原生译文']}]},colors}));
  const out=await invoke(client,{status:200,body});assert.deepEqual(out.bytes,body);assert.equal(out.calls.length,0);assert.equal(out.done,1);
});
for(const client of clients)for(const body of ['{}','{"lyrics":{"showUpsell":true,"lines":[]}}','{"lyrics":"future-schema"}'])test(`${client}: unknown or restricted JSON is never converted to missing lyrics (${body})`,async()=>{
  const out=await invoke(client,{status:200,body});assert.equal(out.bytes.toString(),body);assert.equal(out.calls.length,0);assert.equal(out.done,1);
});
for(const client of clients)test(`${client}: fake spclient suffix never reaches a source`,async()=>{
  const out=await invoke(client,{host:'spclient.wg.spotify.com.evil.invalid'});assert.equal(out.calls.length,0);assert.equal(out.bytes.toString(),'missing');assert.equal(out.done,1);
});
