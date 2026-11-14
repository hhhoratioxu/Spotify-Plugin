// Execute the existing generated bridge with an in-memory fixture transport.
// No fetch, listener, DNS, Spotify app, user storage or native Loon operations.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const here=new URL('.',import.meta.url), results=[], rows=[];
const manifest=JSON.parse(readFileSync(new URL('runtime/manifest.json',here)));
const words=Array.from({length:48},(_,i)=>'I watch the paper lantern '+i+'.');
const lrc=words.map((w,i)=>{const t=i*2100+1000;return '['+String(Math.floor(t/60000)).padStart(2,'0')+':'+(t%60000/1000).toFixed(2).padStart(5,'0')+']'+w;}).join('\n');
for(const variant of ['mobile','macos']){
  let finish,reject,transportCalls=0;
  const completion=new Promise((resolve,fail)=>{finish=resolve;reject=fail;});
  const request=(method,options,callback)=>{
    transportCalls++;
    const url=new URL(options.url);
    assert.equal(url.origin,'http://127.0.0.1:18766');
    let status=200,body;
    if(method==='GET'&&/^\/data\/\d+\.json$/.test(url.pathname)){
      const f=JSON.parse(readFileSync(new URL('runtime'+url.pathname,here)));
      for(const pair of f.store){
        const cache=JSON.parse(pair[1]);for(const e of cache.entries)e.expires=Date.now()+600000;
        const parts=cache.entries.map(e=>JSON.stringify(e));pair[1]='{"sizes":'+JSON.stringify(parts.map(s=>s.length))+',"entries":['+parts.join(',')+'],"cooldowns":{}}';
      }
      body=JSON.stringify(f);
    }else if(method==='GET'&&['/service/source','/service/translation'].includes(url.pathname)){
      const index=Number(url.searchParams.get('case'));assert.ok(Number.isInteger(index)&&index>=0&&index<manifest.cases.length);
      const f=JSON.parse(readFileSync(new URL('runtime/data/'+index+'.json',here)));
      if(f.failure){queueMicrotask(()=>callback('fixture timeout',{status:0,headers:{}},''));return;}
      if(f.oversizedService)body='x'.repeat(98305);
      else if(url.pathname.endsWith('/source'))body=JSON.stringify({trackName:'Paper Lantern',artistName:'Ada North',albumName:'Quiet Walk',duration:180,syncedLyrics:lrc});
      else{
        const queries=new URL(url.searchParams.get('query')).searchParams.getAll('q');
        body=JSON.stringify(queries.map(w=>words.includes(w)?'自写中文译文 '+words.indexOf(w):'自写译文'));
      }
    }else if(method==='POST'&&url.pathname==='/result'){
      const row=JSON.parse(options.body);assert.equal(row.executionHost,'Node-preflight');assert.equal(row.variant,variant);rows.push(row);status=204;body='';
    }else throw Error('Unexpected offline fixture transport');
    queueMicrotask(()=>callback(null,{status,headers:{'Content-Type':'application/json'}},new Uint8Array(Buffer.from(body))));
  };
  const watchdog=setTimeout(()=>reject(Error('Offline bridge did not complete')),10000);
  try{
    const context=vm.createContext({$httpClient:{get:(o,cb)=>request('GET',o,cb),post:(o,cb)=>request('POST',o,cb)},$done:finish});
    new vm.Script(readFileSync(new URL('runtime/'+variant+'.js',here),'utf8')).runInContext(context,{timeout:2000});
    const result=JSON.parse((await completion).content);
    assert.equal(result.executionHost,'Node-preflight');assert.equal(result.completed,manifest.cases.length*2);assert.equal(result.error,null);assert.equal(result.matched,manifest.cases.length*2);
    results.push({...result,transportCalls});
  }finally{clearTimeout(watchdog);}
}
const report={recordedAt:new Date().toISOString(),scope:'Node VM bridge with in-memory fixture transport; not a native Loon run or memory measurement',listenerStarted:false,networkRequests:0,productionStorageAccessed:false,results,rows};
mkdirSync(new URL('evidence/',here),{recursive:true});
writeFileSync(new URL('evidence/offline-preflight-summary.json',here),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({completed:rows.length,matched:rows.filter(r=>r.matchesReference).length,networkRequests:0,nativeAcceptance:false}));
