import test from 'node:test';
import assert from 'node:assert/strict';
import run,{translate,loadCache,settings} from '../src/spotify-lyrics.js';

const id='0000000000000000000001',url='https://spclient.wg.spotify.com/color-lyrics/v2/track/'+id;
const KEY='VerseLyrics.v1.cache';
const samples=[
  ['ja',['海の灯りが揺れる','手紙']],['jpn',['海の灯りが揺れる','手紙']],['ja-JP',['海の灯りが揺れる','手紙']],
  ['ko-KR',['바다 위의 빛','가벼운 바람']],['kor',['바다 위의 빛','가벼운 바람']],
  ['fr',['La lumière sur la mer','Un jardin tranquille']],['de',['Das Licht am Meer','Ein ruhiger Garten']],
  ['es',['La luz sobre el mar','Un jardín tranquilo']],['ru',['Свет над морем','Тихий сад']],
  ['ar',['نور فوق البحر','حديقة هادئة']],['th',['แสงเหนือทะเล','สวนเงียบสงบ']],
  ['vi',['Ánh sáng trên biển','Khu vườn yên tĩnh']],['',['海の灯りが揺れる','bonjour']],
  ['und',['바다 위의 빛','bonjour']],['mul',['海の灯りが揺れる','The quiet sea']]
];

function setup(words,{source='',target='zh-CN',answer,store=new Map(),alternatives=[],env={}}={}) {
  const original={lyrics:{syncType:'LINE_SYNCED',language:source,provider:'Spotify',providerDisplayName:'Spotify',
    lines:words.map((words,i)=>({words,startTimeMs:String(1000+2200*i),endTimeMs:String(3000+2200*i),syllables:[],unknown:i})),
    alternatives,previewLines:[]},colors:{background:-10985626,text:-1},unknown:{keep:true}};
  const input=JSON.stringify(original),calls=[];
  const ctx={env:{FALLBACK_PROVIDER:'off',TARGET_LANGUAGE:target,...env},request:{url,headers:new Headers({Accept:'application/json'})},
    response:new Response(input,{headers:{'Content-Type':'application/json','ETag':'native-tag'}}),
    storage:{get:k=>store.get(k),set:(k,v)=>store.set(k,v),getJSON:k=>store.has(k)?JSON.parse(store.get(k)):null,setJSON:(k,v)=>store.set(k,JSON.stringify(v))},
    http:{get:async value=>{const u=new URL(value),q=u.searchParams.getAll('q');calls.push({q,source:u.searchParams.get('sl')});
      const data=answer?await answer(q,u):q.map((_,i)=>'自写译文 '+i);return new Response(JSON.stringify(data));}}};
  return {ctx,input,original,calls,store};
}
const decode=result=>JSON.parse(Buffer.from(result.body));

for(const [source,words] of samples)for(const target of ['zh-CN','zh-TW'])test('foreign song reaches translation: '+(source||'unknown')+' -> '+target,async()=>{
  const x=setup(words,{source,target}),out=decode(await run(x.ctx));
  assert.ok(x.calls.length>0);assert.deepEqual(out.lyrics.lines,x.original.lyrics.lines);
  assert.deepEqual(out.colors,x.original.colors);assert.deepEqual(out.unknown,x.original.unknown);
  assert.equal(out.lyrics.alternatives[0].language,target);assert.ok(out.lyrics.alternatives[0].lines.every(Boolean));
});

for(const target of ['zh-CN','zh-TW','en','ja','ko'])for(const source of ['zh','zh-Hant',''])test('Chinese originals remain exact for '+target+' with '+(source||'unknown')+' source',async()=>{
  const words=['原創紙燈照著海面','原创纸灯照着海面','我想你 啊','ㄓㄨㄥ 中文'],alts=[{language:'en',lines:words.map(()=> 'NATIVE')}];
  const x=setup(words,{source,target,alternatives:alts,answer:()=>{throw Error('Chinese must not call HTTP');}}),out=await run(x.ctx);
  assert.equal(Buffer.from(out.body).toString(),x.input);assert.equal(x.calls.length,0);
});

test('Japanese kanji and an English medley use at most two source groups without reordering output',async()=>{
  const words=['I walk beside the sea','海の灯りが揺れる','The garden is quiet','手紙','東京 flash'];
  const translations=new Map(words.map((s,i)=>[s,'自写译文 '+i]));
  const x=setup(words,{source:'ja',answer:q=>q.map(s=>translations.get(s))}),out=decode(await run(x.ctx));
  assert.equal(x.calls.length,2);
  assert.deepEqual(x.calls.find(c=>c.source==='ja').q,['海の灯りが揺れる','手紙','東京 flash']);
  assert.deepEqual(new Set(x.calls.find(c=>c.source==='auto').q),new Set([words[0],words[2]]));
  assert.deepEqual(out.lyrics.alternatives[0].lines,words.map(s=>translations.get(s)));
  assert.deepEqual(out.lyrics.lines,x.original.lyrics.lines);
});

for(const target of ['zh-CN','zh-TW','ja'])test('mixed Chinese and English preserves literal Chinese for '+target,async()=>{
  const x=setup(['原創紙燈 says hello','又见灯光'],{source:'zh',target,answer:q=>{assert.deepEqual(q,['says hello']);return ['向你问好'];}});
  const out=decode(await run(x.ctx));assert.deepEqual(out.lyrics.alternatives[0].lines,['原創紙燈 向你问好','']);
  assert.deepEqual(out.lyrics.lines,x.original.lyrics.lines);assert.equal(x.calls.length,1);
});

test('old whole-row cache cannot convert a Chinese fragment',async()=>{
  const x=setup(['原創紙燈 says hello'],{source:'zh',answer:()=>['向你问好']});
  const cache=loadCache(x.ctx);cache.put('translations:v1:zh-CN:'+id,{pairs:[['原創紙燈 says hello','原创纸灯 向你问好']]});cache.save();
  const out=decode(await run(x.ctx));assert.equal(out.lyrics.alternatives[0].lines[0],'原創紙燈 向你问好');assert.equal(x.calls.length,1);
});

test('Japanese meaningful kanji translates but conversion-only output is suppressed',async()=>{
  const x=setup(['手紙','原創紙燈'],{source:'ja',answer:q=>q.map(s=>s==='手紙'?'信件':'原创纸灯')}),out=decode(await run(x.ctx));
  assert.deepEqual(out.lyrics.alternatives[0].lines,['信件','']);
});

for(const source of ['ja','ko','fr',''])test('translation failure preserves official alternatives and response bytes: '+(source||'unknown'),async()=>{
  const x=setup(['海の灯りが揺れる','The quiet sea'],{source,alternatives:[{language:'zh-CN',lines:['原生译文一','原生译文二']}],answer:()=>{throw Error('simulated timeout');}});
  const out=await run(x.ctx);assert.equal(Buffer.from(out.body).toString(),x.input);
});

test('warm foreign cache and cache-only avoid all network calls',async()=>{
  const words=['海の灯りが揺れる','手紙'],x=setup(words,{source:'ja'}),first=decode(await run(x.ctx));assert.equal(x.calls.length,1);
  for(const env of [{},{NETWORK_MODE:'cache-only'}]) {
    const warm=setup(words,{source:'ja',store:x.store,env,answer:()=>{throw Error('cache must not request');}});
    assert.deepEqual(decode(await run(warm.ctx)),first);assert.equal(warm.calls.length,0);
  }
});

test('expired foreign translations are requested again',async()=>{
  const words=['海の灯りが揺れる'],x=setup(words,{source:'ja'});await run(x.ctx);
  const saved=JSON.parse(x.store.get(KEY));for(const e of saved.entries)if(e.key.startsWith('translations:'))e.expires=Date.now()-1;x.store.set(KEY,JSON.stringify(saved));
  const fresh=setup(words,{source:'ja',store:x.store,answer:()=>['更新后的译文']});
  assert.equal(decode(await run(fresh.ctx)).lyrics.alternatives[0].lines[0],'更新后的译文');assert.equal(fresh.calls.length,1);
});

test('a 600-line alternating medley stays serial and does not issue one request per language switch',async()=>{
  const words=Array.from({length:600},(_,i)=>i%2?'Original quiet sea '+i:'海の灯り '+i),x=setup(words,{source:'ja'});
  const out=decode(await run(x.ctx));assert.ok(x.calls.length<=12,x.calls.length);assert.equal(out.lyrics.alternatives[0].lines.length,600);
  assert.deepEqual(out.lyrics.lines,x.original.lyrics.lines);assert.ok((x.store.get(KEY)||'').length<=64000);
});

test('translation off and instrumental rows preserve native data without HTTP',async()=>{
  for(const [words,env] of [[['海の灯り'],{TRANSLATION_ENABLED:false}],[['','♫','♪','...'],{}]]) {
    const x=setup(words,{env}),out=await run(x.ctx);assert.equal(out?.body===undefined?x.input:Buffer.from(out.body).toString(),x.input);assert.equal(x.calls.length,0);
  }
});

test('unknown Han-only words remain original instead of guessing Japanese',async()=>{
  const x=setup(['手紙'],{answer:()=>{throw Error('ambiguous Han');}}),out=await run(x.ctx);
  assert.equal(Buffer.from(out.body).toString(),x.input);assert.equal(x.calls.length,0);
});
