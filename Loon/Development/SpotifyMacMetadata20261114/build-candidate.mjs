import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {macJSONMetadata} from './mac-json-metadata.mjs';
import {candidateCodec} from './candidate-codec.mjs';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
const here = new URL('.',import.meta.url);
const baseline = '10049053ce86bd992e3ebb6511ffb28312ba86fb';
const production = '795c677b0d115cab5eb8e4f959424d905a98e3ff';
const original = sourceBuffer(production,'Loon/script/SpotifyLyrics.Entry.Mac.js');
const code = '(function(hostDone){\n'+candidateCodec(131072)+macJSONMetadata.toString()+
  '\nlet result;try{if(typeof $argument!=="string"||$argument.length<=8192)result=macJSONMetadata(typeof $request==="undefined"?null:$request,typeof $response==="undefined"?null:$response,nativeArguments(),{settings,utf8Size,utf8,text,scanJSON:boundedJSON});}catch{}\nif(result){hostDone(result);return;}\n'+original+'\n})($done);\n';
mkdirSync(new URL('runtime/',here),{recursive:true});mkdirSync(new URL('evidence/',here),{recursive:true});
const bytes=Buffer.from(code),sha=b=>createHash('sha256').update(b).digest('hex');
writeFileSync(new URL('runtime/SpotifyLyrics.Entry.Mac.JSON.Candidate.js',here),bytes);
writeFileSync(new URL('evidence/candidate.json',here),JSON.stringify({scope:'Isolated Mac JSON metadata availability candidate; not installed or published',core:'3.2.2',baseline,production,originalEntrySHA256:sha(original),candidate:{bytes:bytes.length,sha256:sha(bytes)},metadataSchema:'Self-written fixture using canonical padded base64 gid, numeric duration and explicit has_lyrics=false; actual target response not captured',limits:{bytes:131072,depth:32,nodes:32768},nativeAcceptance:false,subscriptionChanged:false},null,2)+'\n');
console.log(JSON.stringify({candidateBytes:bytes.length,installed:false}));
