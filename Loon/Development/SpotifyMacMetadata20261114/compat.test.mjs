import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {candidateCodec} from './candidate-codec.mjs';
import {macFallbackCompat} from './mac-fallback-compat.mjs';
const codec=vm.runInNewContext(candidateCodec(262144)+'({utf8Size,utf8,text,scanJSON:boundedJSON,providers:Object.keys(SOURCES)})');
const doc=()=>({lyrics:{provider:'qq',syncType:'LINE_SYNCED',lines:[{words:'自写一句',startTimeMs:'1000',syllables:[]}],alternatives:[]},colors:{background:-1,text:-1,highlightText:-1}});
const output=body=>({status:200,headers:{'x-verselyrics':'3.2.2','Content-Type':'application/json','X-Unknown':'keep'},body:body??Buffer.from(JSON.stringify(doc()))});
const run=(out,response={status:404})=>macFallbackCompat(response,out,codec);
test('only insert the missing preview array, retaining unknown raw integers and formatting',()=>{
  const input='\n'+JSON.stringify(doc()).slice(0,-1)+',"future":90071992547409931234567890}\t',out=output(input),fixed=run(out);
  assert.equal(fixed.body,input.replace('],"alternatives":[]}','],"alternatives":[],"previewLines":[]}'));assert.equal(out.body,input);assert.equal(fixed.headers['X-Unknown'],'keep');
});
for(const status of [200,401,403,429,500])test('do not touch upstream status '+status,()=>{const out=output();assert.equal(run(out,{status}),out);});
for(const edit of [d=>d.lyrics.provider='Musixmatch',d=>d.lyrics.previewLines=null,d=>d.lyrics.previewLines=[],d=>d.lyrics.syncType='SYLLABLE_SYNCED',d=>d.lyrics.lines[0].syllables=[{startTimeMs:'1000'}],d=>d.lyrics.lines[0].startTimeMs='invalid',d=>d.lyrics.lines=[],d=>d.lyrics.lines[0].startTimeMs='86400001'])test('unknown/native/word-timed structures pass unchanged: '+edit.toString(),()=>{const d=doc();edit(d);const out=output(Buffer.from(JSON.stringify(d)));assert.equal(run(out),out);});
for(const body of [Buffer.from([0xff]),'{"lyrics":{},"lyrics":{}}',JSON.stringify(doc()).slice(0,-1)+',"future":{"k":1,"k":2}}',Buffer.alloc(262145)])test('malformed, duplicate and oversize fallback preserves its original output',()=>{const out=output(body);assert.equal(run(out),out);});
test('body limit includes the inserted field and fails open at the boundary',()=>{
  const base=JSON.stringify(doc()),body=base.slice(0,-1)+',"pad":"'+'x'.repeat(262144-Buffer.byteLength(base)-9)+'"}';assert.equal(Buffer.byteLength(body),262144);const out=output(body);assert.equal(run(out),out);
});
test('recognized empty 200 can complete an owned successful fallback without changing the empty input',()=>{
  const response={status:200,headers:{'Content-Type':'application/json'},body:Buffer.from(JSON.stringify({lyrics:{syncType:'LINE_SYNCED',lines:[],previewLines:[]}}))},before=Buffer.from(response.body),out=output();
  assert.deepEqual(JSON.parse(Buffer.from(run(out,response).body)).lyrics.previewLines,[]);assert.deepEqual(response.body,before);
});
test('unknown, native-word, preview and access structures in 200 remain untouched',()=>{
  const variants=[{}, {lyrics:{syncType:'LINE_SYNCED',lines:[{words:'native word',startTimeMs:'0'}]}}, {lyrics:{syncType:'LINE_SYNCED',lines:[],previewLines:[{words:'native preview'}]}}, {lyrics:{syncType:'LINE_SYNCED',lines:[],capStatus:'UNKNOWN'}}, {showUpsell:true,lyrics:{syncType:'LINE_SYNCED',lines:[]}}];
  for(const original of variants){const out=output();assert.equal(run(out,{status:200,headers:{'Content-Type':'application/json'},body:Buffer.from(JSON.stringify(original))}),out);}
});
