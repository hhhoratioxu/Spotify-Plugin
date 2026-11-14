// Shared independent QQ/NetEase fixtures. No network; public metadata only.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const target=JSON.parse(readFileSync(new URL('../../../history/3.2.2/core/test/fixtures/target-song.json',import.meta.url),'utf8'));
const meta={id:target.track_id,title:target.expected.title,artists:target.expected.artists,album:target.expected.album,duration:target.expected.duration};
const original=Buffer.from('{"error":"fixture-only missing lyrics"}');
const lyric='[00:01.00]自写夏日第一句\n[00:03.25]自写夏日第二句';
const words=['自写夏日第一句','自写夏日第二句'];
const seed=()=>new Map([['VerseLyrics.v1.cache',JSON.stringify({entries:[{key:'meta:'+meta.id,value:meta,expires:Date.now()+600000}],cooldowns:{}})]]);
export async function fallbackFixture({code,provider='qq',store=seed(),cold=false,wrongArtist=false,version='',duration=246,invalidID=false,fail=false,status=404,body=original}={}){
  if(cold)store=new Map();
  const calls=[],done=[],diagnosticEvents=[];
  let finish;const completed=new Promise(r=>finish=r);
  const context={
    $request:{url:'https://spclient.wg.spotify.com/color-lyrics/v2/track/'+meta.id+'?format=json',method:'GET',headers:{Accept:'application/json',Authorization:'Bearer FIXTURE_ONLY_AUTH',Cookie:'FIXTURE_ONLY_COOKIE'}},
    $response:{status,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=600','X-Fixture':'preserve'},body:new Uint8Array(body)},
    $argument:{FALLBACK_PROVIDER:provider,FETCH_ARTWORK_COLOR:false,TARGET_LANGUAGE:'zh-CN'},
    $persistentStore:{read:k=>store.get(k),write:(v,k)=>store.set(k,v)},
    $done:r=>{done.push(r);finish(r);},console:{log(){throw Error('no unsolicited logs');}}
  };
  function request(options,callback){
    if(options.url==='http://127.0.0.1:18765/events'){
      const event=JSON.parse(options.body);assert.deepEqual(Object.keys(event).sort(),['lyricsFlags','pair','publicTargetMatched','route','stage']);assert.equal(typeof event.publicTargetMatched,'boolean');assert.doesNotMatch(options.body,/FIXTURE_ONLY|PRIVATE_FIXTURE|https?:|spotify:track:/);diagnosticEvents.push(event);callback(null,{status:204},'');return;
    }
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
  return {result:done[0],calls,store,effective:Buffer.from(done[0].body||body),diagnosticEvents};
}
