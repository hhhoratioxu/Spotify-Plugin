import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {packagedModules,desktopHarness} from './desktop-modules.mjs';
import {fallbackFixture} from './fallback-fixture.mjs';
const packaged=packagedModules();
const options={skip:!packaged&&'Installed Spotify snapshot absent; not a native acceptance test'};
const old=sourceBuffer('795c677b0d115cab5eb8e4f959424d905a98e3ff','Loon/script/SpotifyLyrics.Mac.js').toString();
const fixed=readFileSync(new URL('runtime/SpotifyLyrics.Mac.Fallback.Candidate.js',import.meta.url),'utf8');
const valid=()=>({lyrics:{syncType:'LINE_SYNCED',lines:[{startTimeMs:'1000',words:'Self written line'}],previewLines:[],provider:'fixture',providerDisplayName:'Fixture',alternatives:[]},colors:{text:-1,highlightText:-1,background:-1}});
for(const metadataBody of [{has_lyrics:false},{},{hasLyrics:true}])test('actual packaged hook leaves lyrics disabled for decoded body '+JSON.stringify(metadataBody),options,async()=>{
  const h=desktopHarness(packaged,{metadataBody,lyricBody:valid()}),result=await h.settle();assert.equal(result.data.hasLyrics,false);assert.equal(h.requests.length,1);assert.equal(h.requests[0].host,'https://spclient.wg.spotify.com/metadata/4');
  assert.equal(h.requests[0].query,undefined,'the helper does not specify metadata wire representation');
});
test('actual packaged modules enable color-lyrics JSON after decoded has_lyrics true',options,async()=>{
  const h=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:valid()}),result=await h.settle();assert.equal(result.data.hasLyrics,true);assert.equal(h.requests.length,2);assert.equal(h.requests[1].host,'https://spclient.wg.spotify.com/color-lyrics/v2');assert.equal(h.requests[1].query.format,'json');
  assert.equal(h.queries.find(q=>q.queryKey[0]==='useLyricsAvailability').staleTime,600000);
});
test('actual availability feature gate remains necessary; candidate does not bypass it',options,async()=>{
  const h=desktopHarness(packaged,{feature:false,metadataBody:{has_lyrics:true},lyricBody:valid()});assert.equal((await h.settle()).data.hasLyrics,false);assert.equal(h.requests.length,0);
});
test('supplying cached false to the actual hook keeps lyrics disabled despite changed mock server data',options,async()=>{
  const h=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:valid()});h.seedAvailability(false);assert.equal((await h.settle()).data.hasLyrics,false);assert.equal(h.requests.length,0);
});
test('missing cover prevents the actual lyrics query function from sending a request',options,async()=>{
  const h=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:valid(),image:''});assert.equal((await h.settle()).data.hasLyrics,false);assert.equal(h.requests.length,1);
});
for(const provider of ['qq','netease'])test('actual packaged parser reproduces the missing previewLines contract for '+provider,options,async()=>{
  const out=await fallbackFixture({code:old,provider}),body=JSON.parse(out.effective);assert.equal(out.result.status,200);assert.equal(Object.hasOwn(body.lyrics,'previewLines'),false);
  const h=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:body}),result=await h.settle();assert.equal(result.error,true);assert.equal(h.errors().length,1);assert.match(h.errors()[0].message,/map/);
});
for(const provider of ['qq','netease'])test('Mac-only fallback candidate passes the actual packaged parser for '+provider,options,async()=>{
  const before=await fallbackFixture({code:old,provider}),out=await fallbackFixture({code:fixed,provider}),body=JSON.parse(out.effective);
  assert.deepEqual(out.calls,before.calls);assert.equal(out.result.status,200);assert.deepEqual(body.lyrics.previewLines,[]);
  const h=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:body}),result=await h.settle();assert.equal(result.error,false);assert.equal(result.data.hasLyrics,true);assert.deepEqual(Array.from(result.data.lyrics,l=>l.start),[1000,3250]);assert.deepEqual(Array.from(result.data.lyrics,l=>l.text),['自写夏日第一句','自写夏日第二句']);
});
test('downstream SDK 404 remains no lyrics rather than a fabricated successful view',options,async()=>{
  const h=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricStatus:404});const result=await h.settle();assert.equal(result.data.hasLyrics,false);assert.equal(result.error,false);
});
test('actual packaged hooks accept both isolated candidates in one synthetic response chain',options,async()=>{
  const entry=readFileSync(new URL('runtime/SpotifyLyrics.Entry.Mac.JSON.Candidate.js',import.meta.url),'utf8');
  const hex='e9b099ff35ac4a9ab73e0e14d20b67a6',metadata={gid:Buffer.from(hex,'hex').toString('base64'),name:'Self written target metadata',album:{name:'Fixture'},artist:[{name:'Fixture artist'}],duration:246099,has_lyrics:false};
  let patched;const {default:vm}=await import('node:vm');
  new vm.Script(entry).runInNewContext({$request:{method:'GET',url:'https://spclient.wg.spotify.com/metadata/4/track/'+hex,headers:{}},$response:{status:200,headers:{'Content-Type':'application/json'},body:new Uint8Array(Buffer.from(JSON.stringify(metadata)))},$done:r=>patched=r},{timeout:1000});
  assert.equal(JSON.parse(Buffer.from(patched.body)).has_lyrics,true);
  const out=await fallbackFixture({code:fixed}),h=desktopHarness(packaged,{metadataBody:JSON.parse(Buffer.from(patched.body)),lyricBody:JSON.parse(out.effective)}),result=await h.settle();
  assert.equal(h.requests.length,2);assert.equal(result.error,false);assert.equal(result.data.hasLyrics,true);
});
test('source failures and wrong recordings retain the original response in the wrapped core',async()=>{
  for(const scenario of [{fail:true},{wrongArtist:true},{version:' (Live)'},{version:' (Remix)'},{duration:300}]){
    const before=await fallbackFixture({code:old,...scenario}),after=await fallbackFixture({code:fixed,...scenario});assert.equal(after.result.status,undefined);assert.deepEqual(after.effective,before.effective);assert.deepEqual(after.calls,before.calls);
  }
});
test('native 200 response stays byte-identical and has no new source calls',async()=>{
  const doc=valid();doc.lyrics.language='zh';const body=Buffer.from(JSON.stringify(doc));const out=await fallbackFixture({code:fixed,status:200,body});assert.deepEqual(out.effective,body);assert.equal(out.calls.length,0);
});
test('empty native 200 fallback also passes the packaged desktop parser',options,async()=>{
  const doc=valid();doc.lyrics.lines=[];doc.lyrics.language='zh';const body=Buffer.from(JSON.stringify(doc));
  const before=await fallbackFixture({code:old,status:200,body}),after=await fallbackFixture({code:fixed,status:200,body});
  const broken=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:JSON.parse(before.effective)}),compatible=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:JSON.parse(after.effective)});
  assert.equal((await broken.settle()).error,true);const result=await compatible.settle();assert.equal(result.error,false);assert.equal(result.data.hasLyrics,true);assert.deepEqual(after.calls,before.calls);assert.equal(after.result.status,200);
});
