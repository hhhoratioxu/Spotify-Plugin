import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {fields,text} from '../history/3.2.2/core/spotify-lyrics.js';
import {compileRuntime} from './compile-runtime.mjs';
import {nativeTranslation} from './translation-host.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
let stage=join(root,'build/current-runtime');
if(!existsSync(join(stage,'manifest.json'))||JSON.parse(readFileSync(join(stage,'manifest.json'))).inputs.some(i=>createHash('sha256').update(readFileSync(join(root,i.path))).digest('hex')!==i.sha256))stage=compileRuntime().stage;
const clients=['Loon','Mac','Surge','Egern','QuantumultX','Shadowrocket'];
const id='0000000000000000000001';
const samples=[['ja',['海の灯りが揺れる','手紙','I walk beside the quiet sea']],['ko',['바다 위의 빛','가벼운 바람']],['fr',['La lumière sur la mer','Un jardin tranquille']],['',['海の灯りが揺れる','bonjour']]];
const vi=n=>{let value=BigInt.asUintN(64,BigInt(n));const bytes=[];do{const b=Number(value&127n);value>>=7n;bytes.push(b|(value?128:0));}while(value);return Buffer.from(bytes);};
const bin=(n,bytes)=>Buffer.concat([vi(n*8+2),vi(bytes.length),Buffer.from(bytes)]);
const string=(n,value)=>bin(n,Buffer.from(value));
const number=(n,value)=>Buffer.concat([vi(n*8),vi(value)]);

function fixture(words,source,format,{official=false,syllables=false}={}) {
  const translations=words.map((_,i)=>'原生譯文 '+i);
  const doc={lyrics:{syncType:'LINE_SYNCED',language:source,provider:'Spotify',providerDisplayName:'Original credit',
    lines:words.map((words,i)=>({words,startTimeMs:String(1000+i*2200),endTimeMs:String(3000+i*2200),syllables:syllables?[{startTimeMs:String(1000+i*2200),numChars:1}]:[],future:i})),
    previewLines:[],alternatives:official?[{language:'zh-CN',lines:translations}]:[],future:{keep:true}},colors:{background:-10985626,text:-1},future:'outer'};
  if(format==='json')return {bytes:Buffer.from(JSON.stringify(doc)),doc};
  const lines=words.map((s,i)=>bin(2,Buffer.concat([number(1,1000+i*2200),string(2,s),bin(3,Buffer.concat([number(1,1000+i*2200),number(2,1)])),string(71,'line-future')])));
  const alternative=official?bin(9,Buffer.concat([string(1,'zh-CN'),...translations.map(s=>string(2,s))])):Buffer.alloc(0);
  return {bytes:Buffer.concat([bin(1,Buffer.concat([number(1,2),...lines,string(3,'Spotify'),string(5,'Original credit'),string(10,source),alternative,string(90,'inner-future')])),bin(2,Buffer.concat([number(1,-10985626),number(2,-1)])),string(101,'outer-future')]),doc};
}
function alternatives(bytes,format) {
  if(format==='json')return JSON.parse(bytes).lyrics.alternatives;
  const inner=fields(bytes).find(f=>f.number===1).payload;
  return fields(inner).filter(f=>f.number===9).map(f=>{const value=fields(f.payload);return {language:text(value.find(f=>f.number===1).payload),lines:value.filter(f=>f.number===2).map(f=>text(f.payload))};});
}
function unchangedNative(before,after,format,{mac=false}={}) {
  if(format==='protobuf') {
    const a=fields(before),b=fields(after);
    assert.deepEqual(b.filter(f=>f.number!==1).map(f=>f.raw),a.filter(f=>f.number!==1).map(f=>f.raw));
    assert.deepEqual(fields(b.find(f=>f.number===1).payload).filter(f=>f.number!==9).map(f=>f.raw),fields(a.find(f=>f.number===1).payload).filter(f=>f.number!==9).map(f=>f.raw));
  } else {
    const a=JSON.parse(before),b=JSON.parse(after);
    if(mac)for(let i=0;i<a.lyrics.lines.length;i++) {
      const original=a.lyrics.lines[i].words,actual=b.lyrics.lines[i].words;
      assert.ok(actual===original||actual.startsWith(original+'\n'));b.lyrics.lines[i].words=original;
    }
    delete a.lyrics.alternatives;delete b.lyrics.alternatives;assert.deepEqual(b,a);
  }
}
const reply=value=>{const u=new URL(value);assert.equal(u.hostname,'translate.googleapis.com');return {body:JSON.stringify(u.searchParams.getAll('q').map(s=>'自写译文 '+s))};};

for(const client of clients)for(const format of ['json','protobuf'])for(const target of ['zh-CN','zh-TW'])for(const [source,words] of samples)test(`${client} ${format} ${source||'unknown'} -> ${target}: full staged runtime translates and preserves native timing`,async()=>{
  const input=fixture(words,source,format),r=await nativeTranslation(client,{stage,format,body:input.bytes,sourceReply:reply,env:{TARGET_LANGUAGE:target}});
  assert.equal(r.done,1);assert.equal(r.active,0);assert.equal(r.maxActive,1);assert.ok(r.calls.length>0&&r.calls.length<=2);
  assert.deepEqual(alternatives(r.bytes,format),[{language:target,lines:words.map(s=>'自写译文 '+s)}]);
  unchangedNative(input.bytes,r.bytes,format,{mac:client==='Mac'});
  assert.ok(r.calls.every(c=>!Object.keys(c.options.headers||{}).some(k=>/authorization|cookie/i.test(k))));
});

for(const client of clients)for(const format of ['json','protobuf'])test(`${client} ${format}: Chinese originals and official alternatives stay byte identical`,async()=>{
  const input=fixture(['原創紙燈照著海面','原创纸灯照着海面'],'zh',format,{official:true});
  const r=await nativeTranslation(client,{stage,format,body:input.bytes,sourceReply:()=>{throw Error('no Chinese request');}});
  assert.equal(r.done,1);assert.equal(r.calls.length,0);assert.deepEqual(r.bytes,input.bytes);
});

for(const client of clients)for(const format of ['json','protobuf'])test(`${client} ${format}: translator timeout keeps the entire original response`,async()=>{
  const input=fixture(['海の灯りが揺れる','手紙'],'ja',format,{official:true});
  const r=await nativeTranslation(client,{stage,format,body:input.bytes,sourceReply:()=>{throw Error('simulated HTTP timeout');}});
  assert.equal(r.done,1);assert.deepEqual(r.bytes,input.bytes);assert.equal(r.maxActive,1);
});

for(const client of clients)test(client+': Japanese warm cache avoids HTTP and translation-off preserves bytes',async()=>{
  const input=fixture(['海の灯りが揺れる','手紙'],'ja','json'),store=new Map();
  const first=await nativeTranslation(client,{stage,body:input.bytes,sourceReply:reply,store});
  const warm=await nativeTranslation(client,{stage,body:input.bytes,store,sourceReply:()=>{throw Error('warm cache');}});
  assert.deepEqual(warm.bytes,first.bytes);assert.equal(warm.calls.length,0);assert.equal(warm.done,1);
  const off=await nativeTranslation(client,{stage,body:input.bytes,store,env:{TRANSLATION_ENABLED:false},sourceReply:reply});
  assert.deepEqual(off.bytes,input.bytes);assert.equal(off.calls.length,0);assert.equal(off.done,1);
});

for(const client of clients)for(const format of ['json','protobuf'])test(`${client} ${format}: Chinese/English fragments retain Chinese and simplify no original characters`,async()=>{
  const input=fixture(['原創紙燈 says hello','又见灯光'],'zh',format);
  const r=await nativeTranslation(client,{stage,format,body:input.bytes,sourceReply:value=>{assert.deepEqual(new URL(value).searchParams.getAll('q'),['says hello']);return {body:JSON.stringify(['向你问好'])};}});
  assert.deepEqual(alternatives(r.bytes,format),[{language:'zh-CN',lines:['原創紙燈 向你问好','']}]);unchangedNative(input.bytes,r.bytes,format,{mac:client==='Mac'});assert.equal(r.done,1);
});

for(const client of clients)for(const format of ['json','protobuf'])test(`${client} ${format}: malformed response stays original without network`,async()=>{
  const body=Buffer.from(format==='json'?'{"lyrics":':String.fromCharCode(255));
  const r=await nativeTranslation(client,{stage,format,body,sourceReply:reply});assert.deepEqual(r.bytes,body);assert.equal(r.calls.length,0);assert.equal(r.done,1);
});

for(const track of ['39HrUxcvKF3jtLz7fUDWXc','6149wOhItvVX0zoa1KK5hw'])for(const client of ['Loon','Mac'])test(client+' public requested route '+track+' with self-written Japanese fixture',async()=>{
  const input=fixture(['海の灯りが揺れる','I walk beside the quiet sea'],'ja','json');
  const r=await nativeTranslation(client,{stage,track,body:input.bytes,sourceReply:reply});assert.ok(alternatives(r.bytes,'json')[0].lines.every(Boolean));assert.equal(r.done,1);
});

test('Mac real word/syllable records retain their original text and timing',async()=>{
  const input=fixture(['海の灯りが揺れる'],'ja','json',{syllables:true});
  const r=await nativeTranslation('Mac',{stage,body:input.bytes,sourceReply:reply});unchangedNative(input.bytes,r.bytes,'json');assert.equal(r.done,1);
});

for(const client of ['Loon','Mac','Surge','Egern'])for(const provider of ['qq','netease'])test(client+' '+provider+': precisely aligned Japanese source translations avoid the translation service',async()=>{
  const meta={id,title:'Original Paper Lantern',artists:['Synthetic Artist'],album:'Quiet Garden',duration:180};
  const store=new Map([['VerseLyrics.v1.cache',JSON.stringify({entries:[{key:'meta:'+id,value:meta,expires:Date.now()+600000}],cooldowns:{}})]]);
  const lyric='[00:01.00]海の灯りが揺れる\n[00:03.20]夜の庭で歩く',translated='[00:01.00]海上的灯光摇曳\n[00:03.20]在夜晚的花园行走';
  const r=await nativeTranslation(client,{stage,body:Buffer.from('missing'),status:404,store,env:{FALLBACK_PROVIDER:provider,FETCH_ARTWORK_COLOR:false},sourceReply:value=>{
    assert.ok(!value.includes('translate.googleapis.com'),'aligned source rows must need no translator');
    if(value.includes('/soso/'))return {body:JSON.stringify({code:0,data:{song:{list:[{songmid:'SYNTHETIC',songname:meta.title,singer:[{name:meta.artists[0]}],albumname:meta.album,interval:180}]}}})};
    if(value.includes('/cloudsearch/'))return {body:JSON.stringify({code:200,result:{songs:[{id:9,name:meta.title,ar:[{name:meta.artists[0]}],al:{name:meta.album},dt:180000}]}})};
    return {body:JSON.stringify(provider==='qq'?{code:0,lyric,trans:translated}:{code:200,lrc:{lyric},tlyric:{lyric:translated}})};
  }});
  assert.equal(r.calls.length,2);assert.equal(r.done,1);
  assert.deepEqual(alternatives(r.bytes,'json'),[{language:'zh-CN',lines:['海上的灯光摇曳','在夜晚的花园行走']}]);
});

for(const client of clients)for(const format of ['json','protobuf'])test(`${client} ${format}: a malformed translation batch preserves official alternatives`,async()=>{
  const input=fixture(['海の灯りが揺れる','手紙'],'ja',format,{official:true});
  const r=await nativeTranslation(client,{stage,format,body:input.bytes,sourceReply:()=>({body:'[]'})});assert.deepEqual(r.bytes,input.bytes);assert.equal(r.done,1);
});
