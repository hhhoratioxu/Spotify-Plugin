import vm from 'node:vm';
import {readFileSync} from 'node:fs';
export const id='0000000000000000000001';
export const KEY='SpotifyLyricsPlus.v1.cache';
export const meta={id,title:'Paper Lantern',album:'Quiet Walk',artists:['Ada North'],duration:180};
export const colors={background:-10985626,text:-16777216,highlightText:-1};
export const clients=['Loon','Surge','Egern','Shadowrocket','QuantumultX'];
export const words=['A self written paper lantern.','Our self written evening light.'];
export const verse='[00:01.20]'+words[0]+'\n[00:03.40]'+words[1];
export function seedStore(track=meta){return new Map([[KEY,JSON.stringify({entries:[{key:'meta:'+id,value:track,expires:Date.now()+600000}],cooldowns:{}})]]);}
export function reply(provider,url,{found=true,lyric=verse,track=meta}={}){
  if(url.includes('lrclib.net/')){
    const r={id:101,trackName:track.title,albumName:track.album,artistName:track.artists.join(' '),duration:track.duration,instrumental:false,syncedLyrics:lyric};
    return {status:found?200:new URL(url).pathname==='/api/get'?404:200,body:JSON.stringify(new URL(url).pathname==='/api/get'?found?r:{}:found?[r]:[])};
  }
  if(url.includes('/soso/'))return {body:JSON.stringify({code:0,data:{song:{list:found?[{songmid:'FIXTURE1',songname:track.title,albumname:track.album,singer:track.artists.map(name=>({name})),interval:track.duration}]:[]}}})};
  if(url.includes('/cloudsearch/'))return {body:JSON.stringify({code:200,result:{songs:found?[{id:101,name:track.title,al:{name:track.album},ar:track.artists.map(name=>({name})),dt:track.duration*1000}]:[]}})};
  if(url.includes('kugou.com/'))return {body:JSON.stringify(new URL(url).pathname==='/search'?{status:200,candidates:found?[{id:101,accesskey:'fixture-only',song:track.title,singer:track.artists.join(' '),duration:track.duration*1000}]:[]}:{status:200,id:101,fmt:'lrc',charset:'utf8',content:Buffer.from(lyric).toString('base64')})};
  if(url.includes('search.kuwo.cn'))return {body:JSON.stringify({abslist:found?[{MUSICRID:'MUSIC_101',SONGNAME:track.title,ARTIST:track.artists.join(' '),ALBUM:track.album,DURATION:String(track.duration)}]:[]})};
  if(url.includes('m.kuwo.cn'))return {body:JSON.stringify({code:200,success:true,data:{lrclist:[{time:'1.2',lineLyric:words[0]},{time:'3.4',lineLyric:words[1]}]}})};
  if(url.includes('/suggest/'))return {body:JSON.stringify({data:found?[{title:track.title,artist:{name:track.artists[0]},album:{title:track.album},duration:track.duration}]:[]})};
  if(url.includes('lyrics.ovh'))return {body:JSON.stringify({lyrics:found?words.join('\n'):''})};
  return {body:JSON.stringify(provider==='qq'?{retcode:0,lyric}:{code:200,lrc:{lyric}})};
}
export async function invoke(client,{profile='test-runtime',provider='netease',format='json',status=404,body='missing',headers={},requestHeaders={},store=seedStore(),network=()=>{throw Error('Unexpected network');},env={},host='spclient.wg.spotify.com',url,stage='response',repeatCallbacks=false}={}){
  const calls=[],done=[],timers=[],input=Buffer.from(body);
  const request={url:url||`https://${host}/color-lyrics/v2/track/${id}`,headers:{Accept:format==='json'?'application/json':'application/x-protobuf',...requestHeaders}};
  const config={FALLBACK_PROVIDER:provider,MEMORY_MODE:'compact',FETCH_ARTWORK_COLOR:false,...env};
  const responseHeaders={'Content-Type':format==='json'?'application/json':'application/x-protobuf',...headers};
  let active=0,maxActive=0,synchronous=false,result;
  const requestFixture=async(u,o,method)=>{calls.push({url:u,options:o,method});active++;maxActive=Math.max(maxActive,active);try{return await network(u,o,method);}finally{active--;}};
  if(client==='Egern'){
    const module=await import(new URL(`../${profile}/Egern/script/SpotifyLyrics/spotify-lyrics${stage==='entry'?'-entry':stage==='request'?'-request':''}.js`,import.meta.url));
    const fetch=async(u,o,m)=>{const r=await requestFixture(u,o,m);return new Response(r.body??'',{status:r.status??200,headers:r.headers||{}});};
    const ctx={env:config,request:{...request,headers:new Headers(request.headers)},storage:{get:k=>store.get(k),set:(k,v)=>store.set(k,v),getJSON:k=>store.has(k)?JSON.parse(store.get(k)):null,setJSON:(k,v)=>store.set(k,JSON.stringify(v))},http:{get:(u,o)=>fetch(u,o,'GET'),post:(u,o)=>fetch(u,o,'POST')}};
    if(stage!=='request')ctx.response=new Response(input,{status,headers:responseHeaders});
    result=await module.default(ctx);done.push(result||{});
  }else{
    const qx=client==='QuantumultX';let complete;
    const completed=new Promise(r=>complete=r);
    const ctx={$request:request,Date,console:{log(){throw Error('Unexpected log');}},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},$done:r=>{done.push(r);complete(r);}};
    if(stage!=='request')ctx.$response=qx?{statusCode:status,headers:responseHeaders,bodyBytes:new Uint8Array(input).buffer}:{status,headers:responseHeaders,body:new Uint8Array(input)};
    if(qx){ctx.$environment={variables:config};ctx.$prefs={valueForKey:k=>store.get(k),setValueForKey:(v,k)=>{store.set(k,v);return true;}};ctx.$task={fetch:async o=>{const r=await requestFixture(o.url,o,o.method);return{statusCode:r.status??200,headers:r.headers||{},bodyBytes:new Uint8Array(Buffer.from(r.body??'')).buffer};}};}
    else{ctx.$argument=config;ctx.$persistentStore={read:k=>store.get(k),write:(v,k)=>{store.set(k,v);return true;}};ctx.$httpClient=Object.fromEntries(['get','post'].map(method=>[method,(o,cb)=>{requestFixture(o.url,o,method.toUpperCase()).then(r=>{const args=[null,{status:r.status??200,headers:r.headers||{}},o['binary-mode']===false?String(r.body??''):new Uint8Array(Buffer.from(r.body??''))];cb(...args);if(repeatCallbacks)cb(...args);},e=>{cb(String(e));if(repeatCallbacks)cb(String(e));});}]));}
    const path=`../${profile}/${client}/script/SpotifyLyrics${stage==='entry'?'.Entry':stage==='request'?'.Request':''}.js`;
    vm.runInNewContext(readFileSync(new URL(path,import.meta.url),'utf8'),ctx,{timeout:1000});
    synchronous=done.length===1;
    let guard;
    try{result=await Promise.race([completed,new Promise((_,reject)=>{guard=setTimeout(()=>reject(Error('Missing completion')),2000);})]);}finally{clearTimeout(guard);}
    for(const t of timers)t.fn();
  }
  await new Promise(setImmediate);
  const output=result?.bodyBytes??result?.body;
  return {bytes:output===undefined?input:Buffer.from(output),result:result||{},done:done.length,calls,store,active,maxActive,synchronous,timers};
}
