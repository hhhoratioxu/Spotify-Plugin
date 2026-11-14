import {readFileSync} from 'node:fs';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
const manifest=JSON.parse(readFileSync(new URL('./evidence/diagnosis-artifacts.json',import.meta.url),'utf8'));
const profile=readFileSync(new URL('./DiagnosisMac.lpx',import.meta.url),'utf8');
test('diagnostic contains the exact published Mac production chain and versioned file hashes',()=>{
  for(const item of manifest.files){
    const bytes=readFileSync(new URL('./'+item.file,import.meta.url));
    assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
    if(!item.productionSource)continue;
    const source=item.kind==='request'?'SpotifyLyrics.Request.Mac.js':item.productionSource;
    const published=sourceBuffer(manifest.productionMacCommit,'Loon/script/'+source);
    assert.equal(createHash('sha256').update(published).digest('hex'),item.productionSHA256);
    assert.ok(bytes.includes(published));assert.ok(item.file.includes(item.sha256.slice(0,16)));
    assert.ok(profile.includes('http://127.0.0.1:18765/'+item.file.split('/').at(-1)));
  }
});
test('diagnostic keeps existing Mac parameters, rules, MITM and timeouts',()=>{
  const original=readFileSync(new URL('./DisplayMac.lpx',import.meta.url),'utf8');
  const section=(s,name)=>s.split('['+name+']')[1].split('\n[')[0];
  assert.equal(section(profile,'Argument'),section(original,'Argument'));
  assert.equal(section(profile,'Mitm'),section(original,'Mitm'));
  const rules=s=>s.split('\n').filter(l=>/^(request|response) if /.test(l));
  assert.equal(rules(profile).length,3);
  assert.deepEqual(rules(profile).map(l=>l.replace(/script\("[^"]+"/, 'script("URL"')),rules(original).map(l=>l.replace(/script\("[^"]+"/,'script("URL"')));
  assert.ok(!profile.includes('[Rewrite]'));
});
test('prepared diagnostics have no production subscription reference',()=>{
  const formal=readFileSync(new URL('../../script/SpotifyLyrics.lpx',import.meta.url),'utf8');
  assert.ok(!formal.includes('Diagnosis'));assert.ok(!formal.includes('127.0.0.1'));
  assert.equal(manifest.scope,'Prepared local diagnostic only; not installed, enabled or published');
});
