import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';

// A native API fixture, not a running proxy or Spotify client. Code is read
// from the complete staged build; replies never use the real network.
export async function nativeTranslation(client,{stage,body,format='json',sourceReply,store=new Map(),track='0000000000000000000001',status=200,headerOnly=false,env={}}) {
  const type=format==='json'?'application/json':'application/x-protobuf';
  const calls=[],timers=[];let active=0,maxActive=0,done=0,result;
  const config={FALLBACK_PROVIDER:'off',TARGET_LANGUAGE:'zh-CN',TRANSLATION_ENABLED:true,...env};
  const url='https://spclient.wg.spotify.com/color-lyrics/v2/track/'+track;
  async function request(value,options) {
    calls.push({url:value,options});active++;maxActive=Math.max(active,maxActive);
    try {return await sourceReply(value,options);} finally {active--;}
  }
  if(client==='Egern') {
    const module=await import(pathToFileURL(join(stage,'runtime/Egern/script/SpotifyLyrics/spotify-lyrics.js')));
    const fetch=async(u,o)=>{const r=await request(u,o);return new Response(r.body,{status:r.status??200,headers:r.headers||{}});};
    result=await module.default({env:config,request:{url,headers:new Headers({Accept:type,Authorization:'synthetic-never-forward'})},
      response:new Response(body,{status,headers:{'Content-Type':type}}),
      storage:{get:k=>store.get(k),set:(k,v)=>store.set(k,v),getJSON:k=>store.has(k)?JSON.parse(store.get(k)):null,setJSON:(k,v)=>store.set(k,JSON.stringify(v))},
      http:{get:fetch,post:fetch}});done++;
  } else {
    const qx=client==='QuantumultX';let finish;
    const complete=new Promise(resolve=>finish=resolve);
    const bytes=new Uint8Array(body);
    const context={$request:{url,method:'GET',headers:{Accept:type,Authorization:'synthetic-never-forward'}},
      $response:qx?{statusCode:status,headers:{'Content-Type':type},bodyBytes:bytes.buffer}:{status,headers:{'Content-Type':type},body:bytes},
      setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
      $done:value=>{done++;result=value;finish();}};
    if (headerOnly) delete context.$response.body;
    if(qx) {
      context.$environment={variables:config};context.$prefs={valueForKey:k=>store.get(k),setValueForKey:(v,k)=>store.set(k,v)};
      context.$task={fetch:async o=>{const r=await request(o.url,o);return {statusCode:r.status??200,headers:r.headers||{},bodyBytes:new Uint8Array(Buffer.from(r.body)).buffer};}};
    } else {
      context.$argument=config;context.$persistentStore={read:k=>store.get(k),write:(v,k)=>store.set(k,v)};
      context.$httpClient=Object.fromEntries(['get','post'].map(method=>[method,(options,callback)=>{
        request(options.url,options).then(r=>callback(null,{status:r.status??200,headers:r.headers||{}},options['binary-mode']===false?r.body:new Uint8Array(Buffer.from(r.body))),error=>callback(String(error)));
      }]));
    }
    const path=client==='Mac'?'Loon/script/SpotifyLyrics.Mac.js':client+'/script/SpotifyLyrics.js';
    new vm.Script(readFileSync(join(stage,'runtime',path),'utf8')).runInNewContext(context,{timeout:2000});
    let watchdog;
    try {await Promise.race([complete,new Promise((_,reject)=>watchdog=setTimeout(()=>reject(Error('native fixture did not finish')),1500))]);}
    finally {clearTimeout(watchdog);}
    await new Promise(setImmediate);
  }
  const output=client==='QuantumultX'?result?.bodyBytes:result?.body;
  return {bytes:output===undefined?Buffer.from(body):Buffer.from(output),result,calls,store,maxActive,active,done,timers};
}
