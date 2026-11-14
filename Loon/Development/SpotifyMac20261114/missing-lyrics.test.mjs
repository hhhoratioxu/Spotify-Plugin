// Fixed production Mac artifact + prerecorded public metadata + self-written
// source responses. This checks the response chain, not desktop UI reachability.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('./runtime/SpotifyLyrics.Mac.js',import.meta.url),'utf8');
const target=JSON.parse(readFileSync(new URL('../../../history/3.2.2/core/test/fixtures/target-song.json',import.meta.url),'utf8'));
const meta={id:target.track_id,title:target.expected.title,artists:target.expected.artists,album:target.expected.album,duration:target.expected.duration};
const original=Buffer.from('{"error":"fixture-only missing lyrics"}');
const lyric='[00:01.00]自写夏日第一句\n[00:03.25]自写夏日第二句';
const words=['自写夏日第一句','自写夏日第二句'];
const seed=()=>new Map([['VerseLyrics.v1.cache',JSON.stringify({entries:[{key:'meta:'+meta.id,value:meta,expires:Date.now()+600000}],cooldowns:{}})]]);
async function invoke({provider='qq',store=seed(),cold=false,wrongArtist=false,version='',duration=246,invalidID=false,fail=false,status=404,body=original}={}){
  if(cold)store=new Map();
  const calls=[],done=[];
  let finish;const completed=new Promise(r=>finish=r);
  const context={
    $request:{url:'https://spclient.wg.spotify.com/color-lyrics/v2/track/'+meta.id+'?format=json',method:'GET',headers:{Accept:'application/json',Authorization:'Bearer FIXTURE_ONLY_AUTH',Cookie:'FIXTURE_ONLY_COOKIE'}},
    $response:{status,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=600','X-Fixture':'preserve'},body:new Uint8Array(body)},
    $argument:{FALLBACK_PROVIDER:provider,FETCH_ARTWORK_COLOR:false,TARGET_LANGUAGE:'zh-CN'},
    $persistentStore:{read:k=>store.get(k),write:(v,k)=>store.set(k,v)},
    $done:r=>{done.push(r);finish(r);},console:{log(){throw Error('no unsolicited logs');}}
  };
  function request(options,callback){
    calls.push(options.url);
    if(options.url.includes('/metadata/4/track/')){
      assert.ok(cold);callback(null,{status:200,headers:{'Content-Type':'application/x-protobuf'}},new Uint8Array(Buffer.from(target.metadata_base64,'base64')));return;
    }
    assert.ok(!JSON.stringify(options.headers||{}).includes('FIXTURE_ONLY_AUTH'));
    assert.ok(!JSON.stringify(options.headers||{}).includes('FIXTURE_ONLY_COOKIE'));
    if(fail){callback('fixture source timeout',{status:0,headers:{}},'');return;}
    const artist=wrongArtist?'独立测试歌手':'王俊凯',title=meta.title+version;
    let response;
    if(options.url.includes('/soso/'))response={code:0,data:{song:{list:[{songmid:invalidID?'FIXTURE_QQ_ID':'FIXTUREQQID',songname:title,singer:[{name:artist}],albumname:'WJK',interval:duration}]}}};
    else if(options.url.includes('/cloudsearch/'))response={code:200,result:{songs:[{id:70001,name:title,ar:[{name:artist}],al:{name:'WJK'},dt:duration*1000}]}};
    else if(options.url.includes('c.y.qq.com/lyric/'))response={code:0,lyric};
    else if(options.url.includes('music.163.com/api/song/lyric'))response={code:200,lrc:{lyric}};
    else throw Error('Unexpected external request; no actual network permitted');
    callback(null,{status:200,headers:{'Content-Type':'application/json'}},new Uint8Array(Buffer.from(JSON.stringify(response))));
  }
  context.$httpClient={get:request,post:request};
  new vm.Script(code).runInNewContext(context,{timeout:1000});
  let timer;try{await Promise.race([completed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Mac response fixture did not finish')),1500);})]);}finally{clearTimeout(timer);}
  assert.equal(done.length,1);
  return {result:done[0],calls,store,effective:Buffer.from(done[0].body||body)};
}
for(const provider of ['qq','netease'])test('public target 404 reaches verified '+provider+' fallback and retains real line timestamps',async()=>{
  const out=await invoke({provider}),doc=JSON.parse(out.effective);
  assert.equal(out.result.status,200);assert.equal(out.calls.length,2);
  assert.equal(doc.lyrics.provider,provider);assert.equal(doc.lyrics.syncType,'LINE_SYNCED');
  assert.deepEqual(doc.lyrics.lines.map(l=>l.words),words);
  assert.deepEqual(doc.lyrics.lines.map(l=>Number(l.startTimeMs)),[1000,3250]);
  assert.ok(doc.lyrics.lines.every(l=>!l.syllables?.length));
});
test('cold target uses prerecorded Spotify identity before matching a source, without leaking auth',async()=>{
  const out=await invoke({cold:true});assert.equal(out.result.status,200);assert.equal(out.calls.length,3);
  assert.equal(JSON.parse(out.effective).lyrics.provider,'qq');
});
test('verified target cache avoids repeated source traffic',async()=>{
  const first=await invoke(),second=await invoke({store:first.store,fail:true});
  assert.equal(first.result.status,200);assert.equal(second.result.status,200);assert.equal(second.calls.length,0);
  assert.deepEqual(second.effective,first.effective);
});
for(const scenario of [{name:'different artist',wrongArtist:true},{name:'Live version',version:' (Live)'},{name:'Remix version',version:' (Remix)'},{name:'duration mismatch',duration:300},{name:'invalid QQ identifier',invalidID:true}])test('target identity rejects '+scenario.name+' and preserves upstream missing response',async()=>{
  const out=await invoke(scenario);assert.equal(out.result.status,undefined);assert.deepEqual(out.effective,original);
  assert.ok(out.calls.every(u=>!u.includes('/lyric/')));assert.equal(out.result.headers['X-Fixture'],'preserve');
});
test('source failure preserves upstream status/body and cannot become a successful replacement',async()=>{
  const out=await invoke({fail:true});assert.equal(out.result.status,undefined);assert.deepEqual(out.effective,original);
  assert.equal(out.result.headers['X-Fixture'],'preserve');
});
test('native synchronized Chinese lyrics stay unchanged without source calls',async()=>{
  const doc={lyrics:{syncType:'LINE_SYNCED',language:'zh',provider:'Musixmatch',lines:words.map((words,i)=>({words,startTimeMs:String(1000+i*2250),syllables:[]})),alternatives:[]},colors:{background:4}};
  const body=Buffer.from(JSON.stringify(doc)),out=await invoke({status:200,body});
  assert.deepEqual(out.effective,body);assert.equal(out.calls.length,0);assert.equal(out.result.status,undefined);
});
