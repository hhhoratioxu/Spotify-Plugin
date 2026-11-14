// Prepare a reviewable local diagnostic; this does not import or enable it.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {debugWrap} from './debug-wrap.mjs';
const here=new URL('.',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=[];
let profile=readFileSync(new URL('DisplayMac.lpx',here),'utf8')
  .replace(/^#!name = .*$/m,'#!name = Spotify Mac 无词入口诊断（临时）')
  .replace(/^#!desc = .*$/m,'#!desc = 固定 Mac 运行核心；配对记录输入/输出结构，仅本机回环。未验收，需确认后临时启用。');
for(const [name,kind] of [['SpotifyLyrics.Request.js','request'],['SpotifyLyrics.Mac.js','lyrics'],['SpotifyLyrics.Entry.Mac.js','entry']]){
  const original=readFileSync(new URL('runtime/'+name,here),'utf8');
  const code=kind==='request'?original:debugWrap(original,kind);
  if(!code.includes(original))throw Error('Production runtime bytes not preserved');
  try{new vm.Script(code);}catch(e){throw Error('Diagnostic syntax: '+e.message);}
  const hash=sha(code),file='SpotifyLyrics.Diagnosis.'+kind+'.'+hash.slice(0,16)+'.js';
  writeFileSync(new URL('runtime/'+file,here),code);
  const old='http://127.0.0.1:18765/'+name,next='http://127.0.0.1:18765/'+file;
  if(profile.split(old).length!==2)throw Error('Unexpected profile reference count');
  profile=profile.replace(old,next);
  files.push({file:'runtime/'+file,bytes:Buffer.byteLength(code),sha256:hash,productionSource:name,productionSHA256:sha(original),kind});
}
writeFileSync(new URL('DiagnosisMac.lpx',here),profile);
files.push({file:'DiagnosisMac.lpx',bytes:Buffer.byteLength(profile),sha256:sha(profile)});
writeFileSync(new URL('evidence/diagnosis-artifacts.json',here),JSON.stringify({
  scope:'Prepared local diagnostic only; not installed, enabled or published',
  productionMacCommit:'795c677b0d115cab5eb8e4f959424d905a98e3ff',
  productionMobileCommit:'10049053ce86bd992e3ebb6511ffb28312ba86fb',
  files
},null,2)+'\n');
console.log(JSON.stringify({prepared:files.length,installed:false,enabled:false,pushed:false}));
