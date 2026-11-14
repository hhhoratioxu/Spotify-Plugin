import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {loonDescription} from '../../../tools/display-name.mjs';
import {relocateProfile,runtimeRelease,runtimeURL,verifyRuntimeArtifacts} from '../../../tools/runtime-release.mjs';

export const baseline='10049053ce86bd992e3ebb6511ffb28312ba86fb';
export const macSource='9f7399dda1279689d2436e981a547b1ea45513b3';
export const repo=fileURLToPath(new URL('../../../',import.meta.url));
const here=fileURLToPath(new URL('.',import.meta.url));
const sourcePath='Loon/Development/SpotifyMac20261114/';
export const files=[
  {name:'SpotifyLyrics.Mac.js',source:'SpotifyLyrics.Mac.js'},
  {name:'SpotifyLyrics.Entry.Mac.js',source:'SpotifyLyrics.Entry.Mac.js'},
  {name:'SpotifyLyrics.Request.Mac.js',source:'SpotifyLyrics.Request.js'},
];
export const git=(revision,path)=>sourceBuffer(revision,path);
const sha=b=>createHash('sha256').update(b).digest('hex');
export function section(profile,name){const start=profile.indexOf('['+name+']\n');if(start<0)throw Error('Missing '+name);return profile.slice(start+name.length+3).split(/\n\[/)[0].trim();}
export function rules(profile,name){return section(profile,name).split('\n').filter(line=>/^(request|response) if /.test(line));}
export function createProfile(revision=runtimeRelease.revision){
  if(revision!==runtimeRelease.revision)throw Error('Runtime commit must match the verified independent release');
  verifyRuntimeArtifacts();
  for(const item of files)if(!readFileSync(join(repo,'Loon/script/'+item.name)).equals(git(macSource,sourcePath+'runtime/'+item.source)))throw Error('Runtime differs from tested Mac candidate: '+item.name);
  // Use the released entry, not the earlier artifact commit's temporary pins.
  const old=git(macSource,'Loon/script/SpotifyLyrics.lpx').toString();
  const mac=git(macSource,sourcePath+'DisplayMac.lpx').toString();
  let header=old.slice(0,old.indexOf('[Argument]'))
    .replace(/^#!name = .*$/m,'#!name = SpotifyLyrics')
    .replace(/^#!desc = .*$/m,'#!desc = '+loonDescription)
    .replace(/^#!date = .*$/m,'#!date = 2026-11-15');
  const platform='CLIENT_PLATFORM = select,"mobile","macOS",type=string,tag=运行平台,desc=iPhone/iPad 保持 mobile；Mac 选择 macOS 后使用桌面双语显示。Mac 完全无词入口仍在测试。';
  const gate=(line,mode)=>line.replace(/^(request|response) if /,(_,phase)=>phase+' if ${CLIENT_PLATFORM} == "'+mode+'" && ');
  const mobileRewrite=rules(old,'Rewrite').map(line=>gate(line,'mobile'));
  const mobileScripts=rules(old,'Script').map(line=>gate(line,'mobile'));
  const macScripts=rules(mac,'Script').map(line=>{
    for(const item of files)line=line.replace('http://127.0.0.1:18765/'+item.source,runtimeURL('Loon/script/'+item.name));
    if(line.includes('127.0.0.1')||line.includes('18765'))throw Error('Local development URL leaked');
    return gate(line,'macOS');
  });
  if(mobileRewrite.length!==3||mobileScripts.length!==2||macScripts.length!==3)throw Error('Unexpected baseline shape');
  return relocateProfile(header+'[Argument]\n'+platform+'\n'+section(old,'Argument')+'\n\n[Rewrite]\n'+mobileRewrite.join('\n')+'\n\n[Script]\n'+macScripts.join('\n')+'\n'+mobileScripts.join('\n')+'\n\n[Mitm]\n'+section(old,'Mitm')+'\n');
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const mode=process.argv[2];
  if(mode==='artifacts'){
    const artifacts=[];
    for(const item of files){const bytes=git(macSource,sourcePath+'runtime/'+item.source),path='Loon/script/'+item.name;mkdirSync(join(repo,'Loon/script'),{recursive:true});writeFileSync(join(repo,path),bytes);artifacts.push({path,source:sourcePath+'runtime/'+item.source,bytes:bytes.length,sha256:sha(bytes)});}
    writeFileSync(join(here,'artifacts-manifest.json'),JSON.stringify({macSource,baseline,artifacts},null,2)+'\n');
  }else if(mode==='profile'){
    const revision=process.argv[3],profile=createProfile(revision);writeFileSync(join(repo,'Loon/script/SpotifyLyrics.lpx'),profile);
    writeFileSync(join(here,'subscription-manifest.json'),JSON.stringify({configuration:'2026.11.15-migration',core:'3.2.2',runtimeRepository:runtimeRelease.repository,runtimeCommit:revision,baseline,macSource,profile:{path:'Loon/script/SpotifyLyrics.lpx',bytes:Buffer.byteLength(profile),sha256:sha(profile)},mobileRuntimeChanged:false,iosPeakAcceptance:'unverified',macMissingLyricsEntry:'unverified'},null,2)+'\n');
  }else throw Error('Usage: node build-subscription.mjs artifacts | profile <full-runtime-commit>');
}
