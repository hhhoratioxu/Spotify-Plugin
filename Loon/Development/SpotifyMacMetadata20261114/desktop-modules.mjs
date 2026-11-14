// Read packaged application code, not a running process or user profile.
// Third-party module text stays in memory and is never saved in the repository.
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {tokenizer}=createRequire(require.resolve('terser'))('acorn');
export const snapshotPath='/Applications/Spotify.app/Contents/Frameworks/Chromium Embedded Framework.framework/Versions/A/Resources/v8_context_snapshot.arm64.bin';
export function packagedModules(){
  if(!existsSync(snapshotPath))return null;
  const bytes=readFileSync(snapshotPath);
  if(bytes.length>64*1024*1024)throw Error('Packaged snapshot exceeds limit');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const expected=JSON.parse(readFileSync(new URL('evidence/installed-client-availability.json',import.meta.url)));
  if(sha256!==expected.sha256)throw Error('Installed snapshot changed; inspect the new package before executing isolated modules');
  const source=bytes.toString('utf16le'),modules=new Map();
  for(const id of [48071,68900,83873,91243]){
    const match=new RegExp('\\b'+id+'\\(e,t,i\\)\\{').exec(source);
    if(!match)throw Error('Packaged module missing: '+id);
    const chunk=source.slice(match.index,match.index+16384),tokens=tokenizer(chunk,{ecmaVersion:'latest'});
    let depth=0,started=false,end=0;
    for(let count=0;count<8192;count++){
      const token=tokens.getToken(),label=token.type.label;
      if(label==='eof')break;
      if(label==='{'||label==='${'){depth++;started=true;}
      if(label==='}'&&started&&--depth===0){end=token.end;break;}
    }
    if(!end)throw Error('Packaged module boundary not found: '+id);
    modules.set(id,chunk.slice(0,end));
  }
  return {sha256,modules};
}

export function loadModule(code,id,dependencies,globals={}){
  const exports={};
  const imports=key=>{if(!Object.hasOwn(dependencies,key))throw Error('Unmocked packaged dependency: '+key);return dependencies[key];};
  imports.d=(out,getters,values={})=>{
    for(const [key,get] of Object.entries(getters))Object.defineProperty(out,key,{get,enumerable:true});
    Object.assign(out,values);
  };
  const context=vm.createContext({...globals,exports,imports},{codeGeneration:{strings:false,wasm:false}});
  new vm.Script('({'+code+'})['+id+']({},exports,imports)').runInContext(context,{timeout:250});
  return exports;
}

// React/query/transport are stubs. The four packaged modules themselves are
// unchanged. This exercises decoder-facing contracts, not the native UI/SDK.
export function desktopHarness(packaged,{metadataBody,lyricBody,lyricStatus=200,feature=true,uri='spotify:track:76XUZSb13QUuj1HECY4Hvo',image='https://fixture.invalid/image'}={}){
  const requests=[],queries=[],cache=new Map(),pending=[];
  const endpoints=loadModule(packaged.modules.get(83873),83873,{});
  class HTTPError extends Error{constructor(status){super('Fixture HTTP status');this.status=status;}}
  const builder={build(){
    const request={};const chain={withHost(v){request.host=v;return chain;},withPath(v){request.path=v;return chain;},withQueryParameters(v){request.query=v;return chain;},withEndpointIdentifier(v){request.endpoint=v;return chain;},async send(){requests.push(request);if(request.host!==endpoints.XE&&lyricStatus!==200)throw new HTTPError(lyricStatus);return {body:request.host===endpoints.XE?metadataBody:lyricBody};}};return chain;
  }};
  const transport=loadModule(packaged.modules.get(68900),68900,{47136:{o_h:()=>({id:uri.split(':').at(-1)}),Y8v:()=> 'e9b099ff35ac4a9ab73e0e14d20b67a6'},83873:endpoints});
  const query={I(options){
    queries.push(options);const key=JSON.stringify(options.queryKey);
    const entry=cache.get(key);
    if(options.enabled&&!entry){const item={loading:true};cache.set(key,item);pending.push(Promise.resolve().then(options.queryFn).then(data=>Object.assign(item,{data,loading:false}),error=>Object.assign(item,{error,loading:false})));}
    const current=cache.get(key);return {data:current?.data,isLoading:current?.loading||false,isError:Boolean(current?.error)};
  }};
  const availability=loadModule(packaged.modules.get(48071),48071,{20363:query,56933:{rX:undefined},53745:{NC:()=>feature},47136:{U_m:()=>true},82771:{k:600000},68900:transport,15364:{s6w:'availability-feature'},7540:{A:()=>builder}});
  const hook=loadModule(packaged.modules.get(91243),91243,{62515:{useMemo:fn=>fn()},20363:query,53745:{NC:()=>0},82771:{k:600000},48071:availability,31107:{X:()=>false},68900:transport,1940:{O:HTTPError},14088:{Q:{fromInt:()=>({toCSS:()=> 'fixture-color'})}},9837:{a:{RGB:0}},7540:{A:()=>builder},75154:{g:()=>({data:null})},52921:{h:()=>image},80799:{kA:'language-feature',LZ:{CONTROL:0,SYSTEM_LANGUAGE:1,ALL_LANGUAGES:2}}},{navigator:{language:'en'}});
  return {requests,queries,cache,endpoints,transport,availability,hook,uri,image,
    render:()=>hook.I(uri,[{url:image}]),
    async settle(){for(let i=0;i<4;i++){this.render();if(!pending.length)break;await Promise.all(pending.splice(0));}return this.render();},
    seedAvailability(value){cache.set(JSON.stringify(['useLyricsAvailability',uri]),{data:value,loading:false});},
    errors:()=>[...cache.values()].map(v=>v.error).filter(Boolean)};
}
