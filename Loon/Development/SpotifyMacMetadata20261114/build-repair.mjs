// Assemble the two already tested, narrow Mac fixes. No installation/network.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {strictDebugWrap} from '../SpotifyMac20261114/strict-debug-wrap.mjs';
const here=new URL('.',import.meta.url),out=new URL('repair/',here);
for(const file of ['build-candidate.mjs','build-compat.mjs'])execFileSync(process.execPath,[new URL(file,here).pathname],{stdio:'pipe'});
const production='795c677b0d115cab5eb8e4f959424d905a98e3ff',sha=b=>createHash('sha256').update(b).digest('hex');
const originalProfile=readFileSync(new URL('../SpotifyMac20261114/DiagnosisMac.lpx',here),'utf8');
const originalManifest=JSON.parse(readFileSync(new URL('../SpotifyMac20261114/evidence/diagnosis-artifacts.json',here)));
let profile=originalProfile.replace(/^#!name = .*$/m,'#!name = SpotifyLyrics Mac 修复验证（临时）').replace(/^#!desc = .*$/m,'#!desc = 保留3.2.2核心；验证严格JSON入口和自有补词previewLines兼容。五字段本机诊断，未完成实机验收。');
const files=[];mkdirSync(out,{recursive:true});
for(const [kind,name,candidate] of [['request','SpotifyLyrics.Request.Mac.js',null],['lyrics','SpotifyLyrics.Mac.js','runtime/SpotifyLyrics.Mac.Fallback.Candidate.js'],['entry','SpotifyLyrics.Entry.Mac.js','runtime/SpotifyLyrics.Entry.Mac.JSON.Candidate.js']]){
  const baseline=sourceBuffer(production,'Loon/script/'+name),core=candidate?readFileSync(new URL(candidate,here),'utf8'):'// SpotifyLyrics Mac repair disposable request cache.\n'+baseline;
  if(!core.includes(baseline.toString()))throw Error('Pinned core missing from repair');
  const code=kind==='request'?core:strictDebugWrap(core,kind);new vm.Script(code);
  const hash=sha(code),file='SpotifyLyrics.Repair.'+kind+'.'+hash.slice(0,16)+'.js';writeFileSync(new URL(file,out),code);
  const previous=originalManifest.files.find(x=>x.kind===kind);const oldURL='http://127.0.0.1:18765/'+previous.file.split('/').at(-1);
  if(profile.split(oldURL).length!==2)throw Error('Unexpected repair profile references');profile=profile.replace(oldURL,'http://127.0.0.1:18765/'+file);
  files.push({kind,file,sha256:hash,bytes:Buffer.byteLength(code),productionSource:name,productionSHA256:sha(baseline),pinnedCorePreserved:true});
}
writeFileSync(new URL('RepairMac.lpx',out),profile);files.push({kind:'profile',file:'RepairMac.lpx',sha256:sha(profile),bytes:Buffer.byteLength(profile)});
const manifest={scope:'Local Mac repair verification only; not installed or published',production,changes:['strict metadata JSON false token only with complete verified identity and no access restrictions','empty previewLines only for owned successful fallback after 404 or recognized empty 200','five-field diagnostics with fixed public request or response target match'],fields:['route','stage','pair','publicTargetMatched','lyricsFlags'],identityFieldType:'boolean; exact public request OR known response identity; false is unconfirmed',mobileRuntimeChanged:false,formalSubscriptionChanged:false,parametersRulesDomainsChanged:false,nativeAcceptance:false,files};
writeFileSync(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({prepared:files.length,profileSHA256:sha(profile),installed:false}));
