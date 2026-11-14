// Checks the native test bridge before installation. This is explicitly Node,
// not a Loon run or a memory acceptance result.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const results=[];
for(const variant of ['mobile','macos']){
  let finish,reject;
  const completion=new Promise((r,j)=>{finish=r;reject=j;});
  function request(method,o,cb){
    assert.match(o.url,/^http:\/\/127\.0\.0\.1:18766\//);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),o.timeout||2500);
    fetch(o.url,{method,body:o.body,headers:o.headers,signal:controller.signal}).then(async r=>{
      const b=new Uint8Array(await r.arrayBuffer());clearTimeout(timeout);
      // Deliberately return binary even for text-mode requests to verify the
      // bridge handles both native callback representations.
      cb(null,{status:r.status,headers:Object.fromEntries(r.headers)},b);
    }).catch(e=>{clearTimeout(timeout);cb(e.name==='AbortError'?'native http timeout':'preflight HTTP failed',{status:0,headers:{}},'');});
  }
  const watchdog=setTimeout(()=>reject(Error('Preflight did not finish')),90000);
  const context=vm.createContext({$httpClient:{get:(o,cb)=>request('GET',o,cb),post:(o,cb)=>request('POST',o,cb)},$done:finish});
  try{
    new vm.Script(readFileSync(new URL('./runtime/'+variant+'.js',import.meta.url),'utf8')).runInContext(context,{timeout:2000});
    const result=JSON.parse((await completion).content);
    assert.equal(result.executionHost,'Node-preflight');assert.equal(result.completed,36);assert.equal(result.error,null);assert.equal(result.matched,36);
    results.push(result);
  }finally{clearTimeout(watchdog);}
}
writeFileSync(new URL('./evidence/preflight-summary.json',import.meta.url),JSON.stringify({scope:'Node bridge preflight, not native Loon or memory acceptance',results},null,2)+'\n');
console.log(JSON.stringify(results));
