import test from 'node:test';
import assert from 'node:assert/strict';
import {strictJSONFlags as flags} from './strict-json-flags.mjs';
const gid='e9b099ff35ac4a9ab73e0e14d20b67a6',base64=Buffer.from(gid,'hex').toString('base64'),uri='spotify:track:76XUZSb13QUuj1HECY4Hvo';
const unknown={publicTargetMatched:false,lyricsFlags:['unknown']};
const call=(doc,route='metadata')=>flags(typeof doc==='string'?doc:JSON.stringify(doc),route);
for(const id of [gid,base64])for(const key of ['has_lyrics','hasLyrics'])for(const v of [true,false])test('metadata JSON exact public '+(id===gid?'hex':'base64')+' '+key+' '+v,()=>assert.deepEqual(call({gid:id,[key]:v}),{publicTargetMatched:true,lyricsFlags:[v]}));
test('known identity with absent flag remains omitted',()=>assert.deepEqual(call({gid:base64}),{publicTargetMatched:true,lyricsFlags:['omitted']}));
test('known non-target gid can report its explicit flag without claiming a public match',()=>assert.deepEqual(call({gid:'0'.repeat(32),has_lyrics:false}),{publicTargetMatched:false,lyricsFlags:[false]}));
for(const v of ['false','true',0,1,null,{},[]])test('typed metadata boolean never coerces '+JSON.stringify(v),()=>assert.deepEqual(call({gid:base64,has_lyrics:v}),{publicTargetMatched:true,lyricsFlags:['unknown']}));
test('conflicting flag aliases remain unknown',()=>assert.deepEqual(call({gid:base64,has_lyrics:false,hasLyrics:true}).lyricsFlags,['unknown']));
for(const [name,doc] of [
 ['missing identity',{has_lyrics:false}],['partial identity',{gid:gid.slice(0,-1),has_lyrics:false}],['URI-like gid',{gid:uri,has_lyrics:false}],['noncanonical base64 padding',{gid:base64.slice(0,21)+'h==',has_lyrics:false}],
 ['arbitrary nesting',{private:{gid:base64,has_lyrics:false}}],['unrelated hasLyrics',{hasLyrics:false}],['unsupported JSON array',[{gid:base64,has_lyrics:false}]],
 ['duplicate key','{"gid":"'+gid+'","has_lyrics":false,"has_lyrics":true}'],['escaped duplicate','{"gid":"'+gid+'","has_lyrics":false,"has_\\u006cyrics":true}'],
 ['duplicate opaque key','{"gid":"'+gid+'","x":1,"x":2,"has_lyrics":false}'],['truncated','{"gid":"'+gid+'","has_lyrics":false'],['trailing bytes','{"gid":"'+gid+'"}PRIVATE_FIXTURE_TEXT'],
 ['invalid escape','{"gid":"'+gid+'","x":"\\q"}'],['unpaired escaped surrogate','{"gid":"'+gid+'","x":"\\ud800"}'],['deep nesting','{"gid":"'+gid+'","x":'+'['.repeat(25)+'0'+']'.repeat(25)+'}'],['node limit',{gid:base64,x:Array(8192).fill(null)}]
])test('JSON rejects '+name+' without fabricating a flag',()=>assert.deepEqual(call(doc),unknown));
test('known connect-state JSON reports existing metadata maps only',()=>assert.deepEqual(call({player_state:{track:{uri,metadata:{has_lyrics:'false'}},prev_tracks:[{uri:'spotify:track:'+'A'.repeat(22),metadata:{has_lyrics:true}}],next_tracks:[{uri}]}},'connect-state'),{publicTargetMatched:true,lyricsFlags:[false,true,'omitted']}));
test('known context pages report exact public identity and preserve boolean/string map semantics',()=>assert.deepEqual(call({uri:'spotify:album:'+'A'.repeat(22),pages:[{tracks:[{uri,metadata:{has_lyrics:false}},{uri:'spotify:track:'+'B'.repeat(22),metadata:{has_lyrics:'true'}}]}]},'context-resolve'),{publicTargetMatched:true,lyricsFlags:[false,true]}));
for(const doc of [{player_state:{track:{uri:uri+'x',metadata:{has_lyrics:false}}}},{player_state:{track:{uri,metadata:null}}},{player_state:{track:{uri},next_tracks:[{}]}},{player_state:{next_tracks:Array(17).fill({uri})}}])test('player JSON with missing or invalid identity/flag stays conservative '+JSON.stringify(doc).length,()=>{const out=call(doc,'connect-state');assert.ok(out.lyricsFlags.includes('unknown'));});
for(const route of ['lyrics','extended-metadata','lyrics-entry','player-cards','other'])test('no guessed JSON schema for '+route,()=>assert.deepEqual(call({gid:base64,has_lyrics:false},route),unknown));
test('privacy: opaque strings, keys and credentials never enter minimal result',()=>{const result=call({gid:base64,has_lyrics:false,name:'PRIVATE_FIXTURE_BODY',Authorization:'PRIVATE_FIXTURE_TOKEN',url:'https://private.invalid/PRIVATE_FIXTURE_PATH',lyrics:'PRIVATE_FIXTURE_LYRICS','__proto__':null});assert.deepEqual(result,{publicTargetMatched:true,lyricsFlags:[false]});assert.doesNotMatch(JSON.stringify(result),/PRIVATE_FIXTURE|https?:|spotify:|gid|name|url|Authorization/);});
