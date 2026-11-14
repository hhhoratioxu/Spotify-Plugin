import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {strictDiagnosticInput as normalize} from './strict-input.mjs';
const text=' \n{"name":"自写 🧪 日本語 한국어","has_lyrics":false}';
const data=Buffer.from(text);
for(const [name,input] of [
  ['Uint8Array',new Uint8Array(data)],
  ['direct ArrayBuffer',Uint8Array.from(data).buffer],
  ['Buffer',data],
  ['string',text],
  ['cross-realm ArrayBuffer',vm.runInNewContext('Uint8Array.from('+JSON.stringify([...data])+').buffer')],
  ['cross-realm view',vm.runInNewContext('Uint8Array.from('+JSON.stringify([...data])+')')],
  ['string BOM','\ufeff'+text],
  ['UTF8 BOM',Buffer.concat([Buffer.from([239,187,191]),data])]
])test('strict normalization recognizes '+name,()=>{const before=typeof input==='string'?input:ArrayBuffer.isView(input)?Buffer.from(input.buffer,input.byteOffset,input.byteLength).toString('hex'):Buffer.from(input).toString('hex');assert.equal(normalize(input).text,text);const after=typeof input==='string'?input:ArrayBuffer.isView(input)?Buffer.from(input.buffer,input.byteOffset,input.byteLength).toString('hex'):Buffer.from(input).toString('hex');assert.equal(after,before);});
for(const [name,make] of [['offset Uint8Array',(b)=>new Uint8Array(b.buffer,b.byteOffset+20,data.length)],['offset DataView',(b)=>new DataView(b.buffer,b.byteOffset+20,data.length)],['cross-realm offset view',()=>vm.runInNewContext('new Uint8Array(Uint8Array.from('+JSON.stringify([...Buffer.alloc(20,255),...data,...Buffer.alloc(10,255)])+').buffer,20,'+data.length+')')]])test('normalization uses only '+name,()=>{const backing=Buffer.concat([Buffer.alloc(20,255),data,Buffer.alloc(10,255)]),before=Buffer.from(backing);assert.equal(normalize(make(backing)).text,text);assert.deepEqual(backing,before);});
test('protobuf normalization is a zero-copy byte-range view',()=>{const a=Uint8Array.from([255,10,1,0,255]);const input=new DataView(a.buffer,1,3),out=normalize(input);assert.equal(out.text,null);assert.equal(out.bytes.buffer,a.buffer);assert.equal(out.bytes.byteOffset,1);assert.deepEqual([...out.bytes],[10,1,0]);assert.deepEqual([...a],[255,10,1,0,255]);});
for(const [name,input] of [
 ['unsupported object',{}],['spoofed buffer',{[Symbol.toStringTag]:'ArrayBuffer',byteLength:1}],['null',null],['empty buffer',new ArrayBuffer(0)],['plain text','PRIVATE_FIXTURE_TEXT'],
 ['unpaired high surrogate','{"x":"\ud800"}'],['unpaired low surrogate','{"x":"\udc00"}'],['string over byte limit','{"x":"'+'中'.repeat(43691)+'"}'],['string over character limit',' '.repeat(131073)],['buffer over limit',new ArrayBuffer(131073)],
 ['shared buffer',new SharedArrayBuffer(1)],['shared view',new Uint8Array(new SharedArrayBuffer(1))],
 ['BOM non-JSON',Uint8Array.from([239,187,191,10,1,0])],
 ...[[0xc0,0xaf],[0xe0,0x80,0x80],[0xed,0xa0,0x80],[0xf4,0x90,0x80,0x80],[0xf5,0x80,0x80,0x80],[0x80],[0xe4,0xb8],[0xe4,0x41,0xad]].map((b,i)=>['invalid UTF8 '+i,Buffer.concat([Buffer.from('{"x":"'),Buffer.from(b),Buffer.from('"}')])])
])test('normalization rejects '+name,()=>assert.equal(normalize(input),null));
test('detached buffers are rejected rather than coerced',()=>{const a=new ArrayBuffer(8);structuredClone(a,{transfer:[a]});assert.equal(normalize(a),null);});
test('byte limit is inclusive and counts four-byte scalars accurately',()=>{const exact='{"x":"'+'🧪'.repeat(32766)+'"}';assert.equal(Buffer.byteLength(exact),131072);assert.equal(normalize(exact).text,exact);assert.equal(normalize(exact+' '),null);});
