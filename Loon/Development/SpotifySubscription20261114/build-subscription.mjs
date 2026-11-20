import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {loonDescription} from '../../../tools/display-name.mjs';
import {relocateProfile,runtimeRelease,runtimeURL,verifyRuntimeArtifacts} from '../../../tools/runtime-release.mjs';

export const baseline='10049053ce86bd992e3ebb6511ffb28312ba86fb';
export const macSource='9f7399dda1279689d2436e981a547b1ea45513b3';
// Subscription update time in Asia/Taipei (UTC+8); fixed for reproducible builds.
export const versionDate='2026-11-20 22:05:15';
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
// Loon checks these conditions on the original headers before waiting for a
// complete body. Batch startup/playback responses require a declared bound.
export function mobileResponses(profile){
  const type="${response.header['Content-Type']}",address='${url}',status='${response.status}';
  const get='${request.method} == "GET"';
  const length="${response.header['Content-Length']}",encoding="${response.header['Content-Encoding']}";
  const transfer="${response.header['Transfer-Encoding']}";
  const discover='${DISCOVER_MISSING}',provider='${FALLBACK_PROVIDER}',translate='${TRANSLATION_ENABLED}',marker="${response.header['x-verselyrics']}";
  const unprocessed=`(${marker} == null || ${marker} == "")`;
  const fallback=`${provider} ~= /^(?:auto|lrclib|qq|netease|kugou|kuwo|lyricsovh)$/`;
  const plain=`(${encoding} == null || ${encoding} == "" || ${encoding} ~= /^identity$/i) && ${transfer} == null`;
  const small=`${length} ~= /^(?:[0-9]{1,4}|[12][0-9]{4}|3[01][0-9]{3}|32000)$/`;
  const single=`(${length} == null || ${length} ~= /^(?:[0-9]{1,4}|[1-5][0-9]{4}|6[0-3][0-9]{3}|64000)$/)`;
  const direct=String.raw`${address} ~= /^https:\/\/[^\/?#]+\/(?:metadata\/4\/track\/|scrollsita\/v1\/scroll\/)/`;
  const jsonEntry=String.raw`${address} ~= /^https:\/\/[^\/?#]+\/(?:metadata\/4\/track\/|scrollsita\/v1\/scroll\/|context-resolve\/v1\/|connect-state\/v1\/)/`;
  const json=String.raw`${type} ~= /^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;.*)?$/i`;
  const binary=String.raw`(${type} == null || ${type} == "" || ${type} ~= /^application\/(?:[a-z0-9.+-]*protobuf|octet-stream)(?:\s*;.*)?$/i)`;
  const eligible=(line,...conditions)=>line.replace(' then script(', ' && '+conditions.join(' && ')+' then script(');
  return profile.split('\n').flatMap(line=>{
    if(!line.startsWith('response if ')) return line;
    if(line.includes('/SpotifyLyrics.Entry.js"')) {
      return eligible(line,`${discover} == true`,fallback,unprocessed,plain,`(${small} || (${direct} && ${single}))`,`(${binary} || (${jsonEntry} && ${json}))`);
    }
    if(line.includes('/SpotifyLyrics.js"')) {
      const original=`(${status} == 200 || ${status} == 404)`;
      if(!line.includes(original)) throw Error('Unexpected mobile lyric status guard');
      const missing=eligible(line.replace(original,`${status} == 404`),get,fallback,unprocessed)
        .replace(', requires_body=true, binary_body_mode=true',', requires_body=false');
      const present=eligible(line.replace(original,`${status} == 200`)
        .replace('{${TRANSLATION_ENABLED}', '{${CLIENT_PLATFORM}, ${TRANSLATION_ENABLED}'),
        get,`(${translate} == true || ${fallback})`,unprocessed,plain,single,`(${binary} || ${json})`);
      return [missing,present];
    }
    return line;
  }).join('\n');
}
export function createProfile(revision=runtimeRelease.revision){
  if(revision!==runtimeRelease.revision)throw Error('Runtime commit must match the verified independent release');
  verifyRuntimeArtifacts();
  const request = files.find(item => item.name === 'SpotifyLyrics.Request.Mac.js');
  if (!readFileSync(join(repo, 'Loon/script/'+request.name)).equals(git(macSource,sourcePath+'runtime/'+request.source))) {
    throw Error('Mac request adapter no longer matches the verified original');
  }
  // Use the released entry, not the earlier artifact commit's temporary pins.
  const old=git(macSource,'Loon/script/SpotifyLyrics.lpx').toString();
  const mac=git(macSource,sourcePath+'DisplayMac.lpx').toString();
  let header=old.slice(0,old.indexOf('[Argument]'))
    .replace(/^#!name = .*$/m,'#!name = SpotifyLyrics')
    .replace(/^#!desc = .*$/m,'#!desc = '+loonDescription)
    .replace(/^#!date = .*$/m,'#!date = '+versionDate);
  const platform='CLIENT_PLATFORM = select,"mobile","macOS",type=string,tag=运行平台,desc=iPhone/iPad 保持 mobile；Mac 选择 macOS 后使用桌面双语显示。Mac 完全无词入口仍在测试。';
  const versionTrack='VERSION_TRACK = input,"",type=string,tag=同录音版本查询,desc=填写 Spotify 曲目链接或 ISRC 后手动运行查询。';
  const versionSearch='generic then script("'+runtimeURL('Loon/script/SpotifyLyrics.Versions.js')+'", {${VERSION_TRACK}}) with tag="查找 Spotify 同录音版本", timeout=9';
  const gate=(line,mode)=>line.replace(/^(request|response) if /,(_,phase)=>phase+' if ${CLIENT_PLATFORM} == "'+mode+'" && ');
  // Preserve Spotify's cache and compression negotiation on frequently
  // refreshed player state. Eligible small replies can still be processed.
  const address='${url}';
  const player=String.raw` && ${address} ~= /^(?!https:\/\/[^\/?#]+\/(?:context-resolve\/v1\/|connect-state\/v1\/))/`;
  const mobileRewrite=rules(old,'Rewrite').map(line=>{
    const scoped=line.includes('connect-state')?line.replace(' then ',player+' then '):line;
    return gate(scoped,'mobile');
  });
  const mobileScripts=rules(old,'Script').map(line=>gate(line,'mobile'));
  const macScripts=rules(mac,'Script').map(line=>{
    for(const item of files)line=line.replace('http://127.0.0.1:18765/'+item.source,runtimeURL('Loon/script/'+item.name));
    if(line.includes('127.0.0.1')||line.includes('18765'))throw Error('Local development URL leaked');
    return gate(line,'macOS');
  });
  if(mobileRewrite.length!==3||mobileScripts.length!==2||macScripts.length!==3)throw Error('Unexpected baseline shape');
  return mobileResponses(relocateProfile(header+'[Argument]\n'+platform+'\n'+section(old,'Argument')+'\n'+versionTrack+'\n\n[Rewrite]\n'+mobileRewrite.join('\n')+'\n\n[Script]\n'+macScripts.join('\n')+'\n'+mobileScripts.join('\n')+'\n'+versionSearch+'\n\n[Mitm]\n'+section(old,'Mitm')+'\n'));
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const mode=process.argv[2];
  if(mode==='artifacts'){
    const artifacts=[];
    const macSources = {
      'SpotifyLyrics.Mac.js': 'src/spotify-lyrics.js + mac-display.mjs + mac-runtime.mjs',
      'SpotifyLyrics.Entry.Mac.js': sourcePath+'runtime/SpotifyLyrics.Entry.Mac.js + src/mac-metadata.mjs',
      'SpotifyLyrics.Request.Mac.js': sourcePath+'runtime/SpotifyLyrics.Request.js',
    };
    for(const item of files){
      const path='Loon/script/'+item.name,bytes=readFileSync(join(repo,'build/current-runtime/runtime',path)),pin=runtimeRelease.artifacts.find(a=>a.path===path);
      if(!pin||bytes.length!==pin.bytes||sha(bytes)!==pin.sha256)throw Error('Staged Mac runtime does not match the verified pin: '+path);
      mkdirSync(join(repo,'Loon/script'),{recursive:true});writeFileSync(join(repo,path),bytes);artifacts.push({path,source:macSources[item.name],bytes:bytes.length,sha256:sha(bytes)});
    }
    writeFileSync(join(here,'artifacts-manifest.json'),JSON.stringify({macSource,baseline,runtimeCommit:runtimeRelease.revision,artifacts},null,2)+'\n');
  }else if(mode==='profile'){
    const revision=process.argv[3],profile=createProfile(revision);writeFileSync(join(repo,'Loon/script/SpotifyLyrics.lpx'),profile);
    writeFileSync(join(here,'subscription-manifest.json'),JSON.stringify({configuration:'2026.11.20-dev',versionDate,core:'3.2.2',patch:runtimeRelease.patch,runtimeRepository:runtimeRelease.repository,runtimeCommit:revision,baseline,macSource,profile:{path:'Loon/script/SpotifyLyrics.lpx',bytes:Buffer.byteLength(profile),sha256:sha(profile)},mobileRuntimeChanged:true,iosPeakAcceptance:'unverified',macMissingLyricsEntry:'unverified'},null,2)+'\n');
  }else throw Error('Usage: node build-subscription.mjs artifacts | profile <full-runtime-commit>');
}
