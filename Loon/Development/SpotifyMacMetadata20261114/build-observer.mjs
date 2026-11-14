// Prepare files only. No socket is opened and no client configuration is used.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {candidateCodec} from './candidate-codec.mjs';
import {macJSONMetadata} from './mac-json-metadata.mjs';
import {metadataObservation} from './metadata-observation.mjs';
const here=new URL('.',import.meta.url),files=[],sha=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(new URL('runtime/',here),{recursive:true});mkdirSync(new URL('evidence/',here),{recursive:true});
for(const [kind,body] of [['body',true],['header',false]]){
  const code='(function(){\n'+candidateCodec(131072)+macJSONMetadata.toString()+'\n'+metadataObservation.toString()+
    '\ntry{const event=metadataObservation(typeof $request==="undefined"?null:$request,typeof $response==="undefined"?null:$response,'+body+',{settings,utf8Size,utf8,text,scanJSON:boundedJSON,candidate:macJSONMetadata});if(event){const line="SpotifyLyricsMeta "+JSON.stringify(event);if(line.length<=2048)console.log(line);}}catch{}\n$done({});\n})();\n';
  const hash=sha(code),name='SpotifyLyrics.MetadataObserve.'+kind+'.'+hash.slice(0,16)+'.js';writeFileSync(new URL('runtime/'+name,here),code);files.push({kind,path:'runtime/'+name,bytes:Buffer.byteLength(code),sha256:hash});
}
const original=readFileSync(new URL('../../script/SpotifyLyrics.lpx',here),'utf8');
const size=original.match(/\(\$\{response.header\['Content-Length'\]\} == null \|\| \$\{response.header\['Content-Length'\]\} ~= \/\^\(\?:\[0-9\]\{1,5\}\|1\[0-2\][^\n]+?\/\)/)?.[0];
if(!size)throw Error('Original 128KiB header guard not found');
const base='^https:\\/\\/(?:spclient\\.wg|[a-z0-9-]+-spclient)\\.spotify\\.com(?::443)?\\/';
const metadata=base+'metadata\\/4\\/track\\/e9b099ff35ac4a9ab73e0e14d20b67a6(?:\\?[^#\\s]*)?$';
const lyrics=base+'color-lyrics\\/v2\\/track\\/76XUZSb13QUuj1HECY4Hvo(?:\\/image\\/[^?#\\s]+)?\\/?(?:\\?[^#\\s]*)?$';
const guard="(${request.header['x-verselyrics-internal']} == null || ${request.header['x-verselyrics-internal']} == \"\")";
const rule=(route,extra,kind,tag,body)=>'response if ${request.method} == "GET" && ${url} ~= /'+route+'/ && '+guard+(extra?' && '+extra:'')+' then script("http://127.0.0.1:18767/'+files.find(f=>f.kind===kind).path.split('/').at(-1)+'") with tag="'+tag+'", timeout=1'+(body?', requires_body=true, binary_body_mode=true':'');
const profile='#!name = SpotifyLyrics Mac Metadata 观察（临时）\n#!desc = 只观察一个公开测试曲目的元数据形状和歌词请求状态；不改正文/请求头，不补词，不联网报告。需另获许可才可启用。\n#!author = Horatio\n#!system = macOS\n#!loon_version = 3.5.1(983)\n#!date = 2026-11-14\n\n[Script]\n'+[
  rule(metadata,'${response.status} == 200 && '+size,'body','SpotifyLyrics Metadata Shape',true),
  rule(metadata,'','header','SpotifyLyrics Metadata Status',false),
  rule(lyrics,'','header','SpotifyLyrics Lyrics Status',false)
].join('\n')+'\n\n[Mitm]\n'+original.split('[Mitm]\n')[1];
writeFileSync(new URL('MetadataObserveMac.lpx',here),profile);
files.push({kind:'profile',path:'MetadataObserveMac.lpx',bytes:Buffer.byteLength(profile),sha256:sha(profile)});
writeFileSync(new URL('evidence/observer-artifacts.json',here),JSON.stringify({scope:'Prepared read-only observer; not imported/enabled',port:18767,consolePrefix:'SpotifyLyricsMeta ',maxConsoleCharactersPerRequest:2048,files,requestScripts:0,candidateDeployed:false,networkReportRequests:0,storageAccess:false,nativeAcceptance:false},null,2)+'\n');
console.log(JSON.stringify({prepared:files.length,enabled:false}));
