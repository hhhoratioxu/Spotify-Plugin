// Test-only bridge. The two embedded functions contain exact published bytes.
const variant=__VARIANT__,caseCount=__CASE_COUNT__,results=[],executionHost=typeof $loon==='string'?'Loon':'Node-preflight';
let $request,$response,$argument,$persistentStore,$httpClient,$done;
let index=0,mode='standard',complete=false;
function main(){/*__MAIN__*/}
function entry(){/*__ENTRY__*/}
function hash(b){let h=2166136261;for(let i=0;i<b.length;i++)h=Math.imul(h^b[i],16777619);return h>>>0;}
function decode(s){const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',pad=s.endsWith('==')?2:s.endsWith('=')?1:0,out=new Uint8Array(s.length/4*3-pad);let acc=0,bits=0,at=0;for(let i=0;i<s.length&&s[i]!=='=';i++){acc=acc<<6|abc.indexOf(s[i]);bits+=6;if(bits>=8){bits-=8;out[at++]=acc>>bits&255;}}return out;}
function end(error){if(complete)return;complete=true;const summary={executionHost,variant,completed:results.length,expected:caseCount*2,error:error||null,matched:results.filter(r=>r.matchesReference).length};finish({title:'VerseLyrics Native Memory '+variant,content:JSON.stringify(summary)});}
function transport(method,path,body,callback){const o={url:'http://127.0.0.1:18766'+path,timeout:1500,node:'DIRECT','binary-mode':false,'auto-cookie':false,'auto-redirect':false,insecure:false,headers:{'Content-Type':'application/json'}};if(body!==null)o.body=JSON.stringify(body);try{native[method](o,callback);}catch{end('test transport failed');}}
function next(){
  if(index===caseCount){if(mode==='standard'){mode='compact';index=0;}else{end();return;}}
  transport('get','/data/'+index+'.json',null,(err,res,data)=>{
    if(err||res.status!==200){end('fixture fetch failed');return;}
    let f;try{f=JSON.parse(typeof data==='string'?data:text(data));}catch{end('fixture parse failed');return;}
    const store=new Map(f.store);let calls=0,pending=0,peakPending=0,completions=0;
    $request={url:f.url,method:'GET',headers:{Accept:f.type}};
    $response={status:f.status,headers:{'Content-Type':f.type},body:decode(f.body)};
    $argument={FALLBACK_PROVIDER:'lrclib',TARGET_LANGUAGE:'zh-CN',MEMORY_MODE:mode,FETCH_ARTWORK_COLOR:false};
    $persistentStore={read:k=>store.get(k),write:(v,k)=>{store.set(k,v);return true;}};
    const request=(o,cb)=>{
      if(complete)return;calls++;pending++;peakPending=Math.max(peakPending,pending);
      let route;
      if(o.url.includes('lrclib.net/'))route='source';else if(o.url.includes('translate.googleapis.com/'))route='translation';
      else{pending--;cb('unexpected fixture target',{status:0,headers:{}},'');return;}
      const options={...o,node:'DIRECT',url:'http://127.0.0.1:18766/service/'+route+'?case='+f.index};
      if(route==='translation')options.url+='&query='+encodeURIComponent(o.url);
      // o contains synthetic inputs only; incoming real request headers are never used.
      native.get(options,(error,response,body)=>{pending--;cb(error,response,body);});
    };
    $httpClient={get:request,post:request};
    const started=Date.now();
    $done=output=>{
      if(++completions!==1||pending){end('invalid completion');return;}
      let b=output?.body||$response.body;if(typeof b==='string')b=utf8(b);
      const expected=f.expected[variant+'-'+mode],r={executionHost,variant,mode,index,name:f.name,inputBytes:$response.body.length,outputBytes:b.length,hash:hash(b),expectedHash:expected.hash,calls,expectedCalls:expected.calls,peakPending,completions,milliseconds:Date.now()-started};
      r.matchesReference=r.hash===expected.hash&&calls===expected.calls;results.push(r);
      transport('post','/result',r,(e,response)=>{if(e||response.status!==204){end('result transport failed');return;}index++;next();});
    };
    try{(f.entry?entry:main)();}catch{end('fixture runtime threw');}
  });
}
next();
