import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {nativeTranslation} from './translation-host.mjs';
import {encodeDocument,parseDocument} from '../src/spotify-lyrics.js';

const stage=fileURLToPath(new URL('../build/current-runtime/',import.meta.url));
const entry=new vm.Script(readFileSync(new URL('../build/current-runtime/runtime/Loon/script/SpotifyLyrics.Entry.js',import.meta.url),'utf8'));
const id='0000000000000000000001',gid='00000000000000000000000000000001';
const isrc='ZZAAA2600001',title='波の手紙',originalCredit='Ada North',localCredit='北空アダ';
const meta={gid,name:title,artist:[{name:originalCredit}],album:{name:'静かな海'},duration:180000,external_ids:{isrc},keep:{unknown:true}};
const lyrics=['夜空に小さな灯が揺れる','波が岸へ帰る'];
const translated=['夜空中的小燈搖曳','海浪回到岸邊'];
const times=['1000','3500'];
const key='VerseLyrics.v1.cache';
const mode={CLIENT_PLATFORM:'mobile',FALLBACK_PROVIDER:'lrclib',FETCH_ARTWORK_COLOR:false};

function runEntry(doc,{env=mode,store=new Map(),headers={}}={}) {
  const body=typeof doc==='string'?doc:JSON.stringify(doc);
  const done=[];
  entry.runInNewContext({
    $request:{url:'https://gae2-spclient.spotify.com/metadata/4/track/'+gid,method:'GET',headers:{}},
    $response:{status:200,headers:{'Content-Type':'application/json',...headers},body:new Uint8Array(Buffer.from(body))},
    $argument:env,$persistentStore:{read:k=>store.get(k),write:(v,k)=>store.set(k,v)},
    $done:result=>done.push(result),
  });
  assert.equal(done.length,1,'synchronous native completion');
  return {result:done[0],store};
}

test('mobile track JSON retains untouched fields, marks the no-lyrics entry and caches its validated ISRC',()=>{
  for(const doc of [meta,{...meta,has_lyrics:false}]) {
    const {result,store}=runEntry(doc);
    assert.deepEqual(JSON.parse(Buffer.from(result.body)),{...doc,has_lyrics:true});
    assert.equal(result.headers['Cache-Control'],'no-store');
    const identity=JSON.parse(store.get(key)).entries.find(e=>e.key==='meta:'+id).value;
    assert.deepEqual(identity,{id,title,album:meta.album.name,artists:[originalCredit],duration:180,isrc});
  }
});

test('mobile entry passes through malformed, oversized, conflicting and restricted JSON and leaves the cache alone',()=>{
  for(const doc of [
    {...meta,has_lyrics:true},{...meta,gid:'f'.repeat(32)},{...meta,hasLyrics:false},
    {...meta,restriction:[{catalogue:'account'}]},{...meta,duration:'180000'},
    {...meta,keep:'x'.repeat(64000)},'{"has_lyrics":false,"has_lyrics":true}', '{"gid":',
  ]) {
    const {result,store}=runEntry(doc);
    assert.equal(result.body,undefined);
    assert.equal(store.size,0);
  }
  assert.equal(runEntry(meta,{env:{...mode,DISCOVER_MISSING:false}}).result.body,undefined);
  assert.equal(runEntry(meta,{headers:{'x-verselyrics':'3.2.2'}}).result.body,undefined);
});

test('mobile header-only 404 uses the intercepted identity for localized matching and returns translated synced lyrics',async()=>{
  const {store}=runEntry(meta);
  const catalog={isrc,recordings:[{title,length:180000,
    relations:[{'target-type':'url',url:{resource:'https://open.spotify.com/track/'+id}}],
    'artist-credit':[{name:localCredit,artist:{id:'00000000-0000-0000-0000-000000000003',name:localCredit,aliases:[{name:originalCredit,type:'Artist name'}]}}],
  }]};
  const candidate={trackName:title,artistName:localCredit,albumName:meta.album.name,duration:180,syncedLyrics:'[00:01.00]'+lyrics[0]+'\n[00:03.50]'+lyrics[1]};
  const output=await nativeTranslation('Loon',{stage,body:Buffer.from('original Spotify error body'),status:404,headerOnly:true,env:mode,store,sourceReply:(target,options)=>{
    assert.ok(!Object.keys(options.headers).some(name=>/authorization|cookie|client-token/i.test(name)));
    const url=new URL(target);
    if(url.hostname==='musicbrainz.org') {
      assert.equal(url.pathname,'/ws/2/isrc/'+isrc);
      return {body:JSON.stringify(catalog)};
    }
    if(url.hostname==='lrclib.net') {
      if(url.pathname==='/api/get') return {status:404,body:'{}'};
      return {body:JSON.stringify(url.searchParams.get('artist_name')===localCredit?[candidate]:[])};
    }
    assert.equal(url.hostname,'translate.googleapis.com');
    assert.deepEqual(url.searchParams.getAll('q'),lyrics);
    return {body:JSON.stringify(translated)};
  }});
  assert.equal(output.done,1);
  assert.equal(output.result.status,200);
  assert.equal(output.maxActive,1);
  assert.equal(output.calls.filter(call=>call.url.includes('musicbrainz.org')).length,1);
  assert.ok(output.calls.length<=7);
  const doc=JSON.parse(output.bytes).lyrics;
  assert.equal(doc.syncType,'LINE_SYNCED');
  assert.deepEqual(doc.lines.map(line=>[line.words,line.startTimeMs]),lyrics.map((line,i)=>[line,times[i]]));
  assert.deepEqual(doc.alternatives,[{language:'zh-CN',lines:translated}]);
});

test('mobile header-only no-match leaves the original 404 body and status with Loon',async()=>{
  const original=Buffer.from('original Spotify error body');
  const {store}=runEntry({...meta,external_ids:{}});
  const output=await nativeTranslation('Loon',{stage,body:original,status:404,headerOnly:true,env:mode,store,
    sourceReply:()=>({status:404,body:'{}'})});
  assert.equal(output.done,1);
  assert.equal(output.result.status,undefined);
  assert.equal(output.result.body,undefined);
  assert.deepEqual(output.bytes,original);
});

test('mobile lyric limit checks actual bytes while Mac can translate a larger valid reply',async()=>{
  const doc={lyrics:{syncType:'LINE_SYNCED',language:'ja',lines:lyrics.map((words,i)=>({words,startTimeMs:times[i],endTimeMs:'0',syllables:[]}))},extra:'x'.repeat(64000)};
  const original=Buffer.from(encodeDocument(doc,'json'));
  const sourceReply=()=>({body:JSON.stringify(translated)});
  const mobile=await nativeTranslation('Loon',{stage,body:original,env:{CLIENT_PLATFORM:'mobile'},sourceReply});
  assert.equal(mobile.done,1);
  assert.equal(mobile.calls.length,0);
  assert.deepEqual(mobile.bytes,original);
  const mac=await nativeTranslation('Mac',{stage,body:original,sourceReply});
  assert.equal(mac.done,1);
  assert.equal(mac.calls.length,1);
  const displayed=parseDocument(mac.bytes,'application/json');
  assert.deepEqual(displayed.words,lyrics.map((line,i)=>line+'\n'+translated[i]));
  assert.deepEqual(displayed.lyrics.lines.map(line=>line.startTimeMs),times);
  assert.equal(displayed.hasAlternatives,true);
});
