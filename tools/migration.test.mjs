import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceBuffer, verifySnapshots} from './source-snapshot.mjs';
import {setDisplayName,loonDescription} from './display-name.mjs';
import {relocateProfile} from './runtime-release.mjs';
const root = new URL('../', import.meta.url);
test('all exported source objects verify locally', () => assert.equal(verifySnapshots(), 191));
test('historical commit names never fall back to parent Git or arbitrary files', () => {
  for (const [revision, path] of [['main','Loon/script/SpotifyLyrics.js'], ['0'.repeat(40),'../README.md'], ['0'.repeat(40),'Loon/script/SpotifyLyrics.js']]) assert.throws(() => sourceBuffer(revision,path));
});
test('all 125 recovered files retain their original hashes', () => {
  const m = JSON.parse(readFileSync(new URL('provenance/recovery-manifest.json',root)));
  assert.equal(m.files.length,125);
  for (const f of m.files) assert.equal(createHash('sha256').update(readFileSync(new URL('history/3.2.2/'+f.path,root))).digest('hex'),f.sha256,f.path);
});
test('native entries preserve compatibility while Loon uses the concise numbered description', () => {
  for (const [client,ext] of Object.entries({Loon:'lpx',Surge:'sgmodule',Egern:'yaml',QuantumultX:'conf',Shadowrocket:'sgmodule'})) {
    const p=client+'/script/SpotifyLyrics.'+ext;
    const old=readFileSync(new URL('provenance/compatibility/'+p,root),'utf8');
    const expected=relocateProfile(setDisplayName(old,client));
    assert.equal(readFileSync(new URL(p,root),'utf8'),client==='Loon'?expected.replace(/^#!desc = .*$/m,'#!desc = '+loonDescription).replace(/^#!date = .*$/m,'#!date = 2026-11-15'):expected);
  }
});
test('display naming leaves protocol markers and cache identity intact', () => {
  const source=readFileSync(new URL('src/spotify-lyrics.js',root),'utf8');
  for(const literal of ['VerseLyrics.v1.cache','x-verselyrics-internal','x-verselyrics']) assert.ok(source.includes('"'+literal+'"'));
  assert.equal(JSON.parse(readFileSync(new URL('package.json',root))).version,'3.2.2');
});
