// Create a log-minimized version of original B. Never deploy from this command.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {strictDebugWrap} from './strict-debug-wrap.mjs';
const here=new URL('.',import.meta.url),out=new URL('strict/',here),production='795c677b0d115cab5eb8e4f959424d905a98e3ff';
const sha=b=>createHash('sha256').update(b).digest('hex');
const original=readFileSync(new URL('DiagnosisMac.lpx',here),'utf8');
const oldManifest=JSON.parse(readFileSync(new URL('evidence/diagnosis-artifacts.json',here)));
if(sha(original)!=='2482841b803db9b70b99f8f9eedd8dd5679419e19892358144c61010c4fb4c6b')throw Error('Original B changed');
mkdirSync(out,{recursive:true});let profile=original;const files=[];
for(const [kind,name] of [['request','SpotifyLyrics.Request.Mac.js'],['lyrics','SpotifyLyrics.Mac.js'],['entry','SpotifyLyrics.Entry.Mac.js']]){
  const core=sourceBuffer(production,'Loon/script/'+name),text=core.toString();
  // Unique content hash for every disposable cache, including Request. The
  // comment changes no execution, but avoids sharing its production hash.
  const code=kind==='request'?'// SpotifyLyrics B strict diagnostic cache boundary.\n'+text:strictDebugWrap(text,kind);
  if(!code.includes(text))throw Error('Production core missing');new vm.Script(code);
  const hash=sha(code),file='SpotifyLyrics.Diagnosis.Strict.'+kind+'.'+hash.slice(0,16)+'.js';writeFileSync(new URL(file,out),code);
  const previous=oldManifest.files.find(f=>f.kind===kind);if(!previous)throw Error('Original B script missing');
  const before='http://127.0.0.1:18765/'+previous.file.split('/').at(-1),after='http://127.0.0.1:18765/'+file;
  if(profile.split(before).length!==2)throw Error('Unexpected B reference');profile=profile.replace(before,after);
  files.push({kind,file,bytes:Buffer.byteLength(code),sha256:hash,productionSource:name,productionSHA256:sha(core),cacheContentIsolated:hash!==sha(core)});
}
writeFileSync(new URL('DiagnosisMac.lpx',out),profile);files.push({kind:'profile',file:'DiagnosisMac.lpx',bytes:Buffer.byteLength(profile),sha256:sha(profile)});
const manifest={scope:'Original B with strictly reduced logging; not installed or enabled',originalBProfileSHA256:sha(original),productionMacCommit:production,fields:['route','stage','pair','publicTargetMatched','lyricsFlags'],identityFieldType:'boolean; exact fixed public request OR known response identity; false means unconfirmed, not proven non-target',inputCompatibility:'Read-only 131072-byte normalization; cross-realm ArrayBuffer/views; strict UTF8 JSON strings; known metadata.Track/player/context JSON only',removed:['HTTP status','request method','body/output sizes','format/MIME/encoding','schema paths/type names','duration and field counts','timestamps'],productionCoreChanged:false,requestDifference:'Leading diagnostic comment only, to avoid production cache content hash reuse',newFixCandidatesIncluded:false,profileRulesChanged:false,files};
writeFileSync(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({prepared:files.length,profileSHA256:sha(profile),enabled:false}));
