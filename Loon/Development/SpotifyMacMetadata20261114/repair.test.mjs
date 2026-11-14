import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {fallbackFixture} from './fallback-fixture.mjs';
import {packagedModules,desktopHarness} from './desktop-modules.mjs';
const root=new URL('repair/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root))),read=kind=>readFileSync(new URL(manifest.files.find(f=>f.kind===kind).file,root),'utf8');
test('repair assets preserve pinned production cores and compile with unique verified hashes',()=>{
  for(const f of manifest.files){const b=readFileSync(new URL(f.file,root));assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);if(f.productionSource){const old=sourceBuffer(manifest.production,'Loon/script/'+f.productionSource);assert.ok(b.includes(old));assert.notEqual(f.sha256,f.productionSHA256);new vm.Script(b.toString());}}
  assert.equal(manifest.mobileRuntimeChanged,false);assert.equal(manifest.formalSubscriptionChanged,false);assert.equal(manifest.parametersRulesDomainsChanged,false);
});
test('repair profile changes only visible labels and script file names',()=>{
  const before=readFileSync(new URL('../SpotifyMac20261114/DiagnosisMac.lpx',import.meta.url),'utf8');const normalize=s=>s.replace(/^#!(?:name|desc) = .*$/gm,'#!label').replace(/script\("http:\/\/127\.0\.0\.1:18765\/[^"/]+\.js"/g,'script("SCRIPT"');assert.equal(normalize(read('profile')),normalize(before));
});
const packaged=packagedModules(),options={skip:!packaged&&'Packaged Spotify modules unavailable; not native acceptance'};
for(const provider of ['qq','netease'])test('complete repair runtime supplies '+provider+' fallback accepted by packaged Mac parser',options,async()=>{
  const r=await fallbackFixture({code:read('lyrics'),provider});assert.equal(r.result.status,200);const body=JSON.parse(r.effective);assert.deepEqual(body.lyrics.previewLines,[]);assert.equal(r.diagnosticEvents.length,2);assert.ok(r.diagnosticEvents.every(e=>e.publicTargetMatched));
  const h=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:body}),result=await h.settle();assert.equal(result.error,false);assert.equal(result.data.hasLyrics,true);assert.deepEqual(Array.from(result.data.lyrics,l=>l.start),[1000,3250]);
});
test('repair still preserves existing native lyrics without source requests',async()=>{
  const body=Buffer.from(JSON.stringify({lyrics:{syncType:'LINE_SYNCED',language:'zh',provider:'Musixmatch',lines:[{startTimeMs:'1234',words:'自写原生测试'}],previewLines:[],alternatives:[]},colors:{background:1,text:2,highlightText:3}}));const r=await fallbackFixture({code:read('lyrics'),status:200,body});assert.deepEqual(r.effective,body);assert.equal(r.calls.length,0);assert.equal(r.diagnosticEvents.length,2);
});
test('repair keeps source failures and mismatched recordings unchanged',async()=>{
  const old=sourceBuffer(manifest.production,'Loon/script/SpotifyLyrics.Mac.js').toString();for(const f of [{fail:true},{wrongArtist:true},{version:' (Live)'},{version:' (Remix)'},{duration:300}]){const a=await fallbackFixture({code:old,...f}),b=await fallbackFixture({code:read('lyrics'),...f});assert.deepEqual(b.effective,a.effective);assert.deepEqual(b.calls,a.calls);}
});
test('repair metadata JSON edits only verified false and emits exactly the five approved fields',()=>{
  const original=' {"gid":"6bCZ/zWsSpq3Pg4U0gtnpg==","name":"Self written metadata","album":{"name":"Fixture"},"artist":[{"name":"Fixture"}],"duration":246099,"has_lyrics":false,"future":18446744073709551615} ',events=[],done=[];
  new vm.Script(read('entry')).runInNewContext({$request:{method:'GET',url:'https://spclient.wg.spotify.com/metadata/4/track/e9b099ff35ac4a9ab73e0e14d20b67a6',headers:{}},$response:{status:200,headers:{'Content-Type':'application/json'},body:original},$done:r=>done.push(r),$httpClient:{post(o,cb){const e=JSON.parse(o.body);assert.deepEqual(Object.keys(e).sort(),['lyricsFlags','pair','publicTargetMatched','route','stage']);events.push(e);cb(null,{status:204},'');}}},{timeout:1000});
  assert.equal(done.length,1);assert.equal(done[0].body,original.replace('"has_lyrics":false','"has_lyrics":true'));assert.deepEqual(events.map(e=>e.lyricsFlags),[[false],[true]]);assert.ok(events.every(e=>e.publicTargetMatched));
});
