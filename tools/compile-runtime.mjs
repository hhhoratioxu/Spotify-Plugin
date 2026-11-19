import {readFileSync,writeFileSync,readdirSync,mkdirSync,mkdtempSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceBuffer} from './source-snapshot.mjs';
import {macDisplay} from '../Loon/Development/SpotifyMac20261114/mac-display.mjs';
import {macMetadataRuntime,macLyricsRuntime} from './mac-runtime.mjs';

const project=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// Stage a complete runtime before adopting an immutable release pin. No
// installed client, active import file, Git ref or network resource is changed.
export function compileRuntime(root=project) {
  const scratch=mkdtempSync(join(tmpdir(),'spotifylyrics-current-'));
  const stage=join(root,'build/current-runtime');
  const inputs=[];
  try {
    for (const [name,dest] of Object.entries({'build.mjs':'build.mjs','spotify-lyrics.js':'core/spotify-lyrics.js','native-adapter.js':'native-adapter.js','native-flow.mjs':'native-flow.mjs','NOTICE-UNICODE.txt':'core/NOTICE-UNICODE.txt'})) {
      const bytes=readFileSync(join(root,'src',name)),path=join(scratch,dest);
      mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);inputs.push({path:'src/'+name,sha256:sha(bytes)});
    }
    symlinkSync(join(root,'node_modules'),join(scratch,'node_modules'),'dir');
    execFileSync(process.execPath,['build.mjs'],{cwd:scratch,stdio:'pipe',maxBuffer:1024*1024});
    mkdirSync(stage,{recursive:true});writeFileSync(join(stage,'request-core.js'),readFileSync(join(scratch,'request-core.js')));
    const artifacts=[];
    function save(path,bytes) {
      const dest=join(stage,'runtime',path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,bytes);
      artifacts.push({path,bytes:bytes.length,sha256:sha(bytes)});
    }
    function install(dir,relative='') {
      for (const item of readdirSync(dir,{withFileTypes:true})) {
        const path=join(relative,item.name),source=join(dir,item.name);
        if(item.isDirectory())install(source,path);else save(path,readFileSync(source));
      }
    }
    install(join(scratch,'runtime'));
    // Preserve the established Mac transport and entry core. Mac-only wrappers
    // adapt the observed JSON identity, desktop output and preload concurrency.
    const previous='795c677b0d115cab5eb8e4f959424d905a98e3ff';
    const source=readFileSync(join(root,'src/spotify-lyrics.js'),'utf8');
    save('Loon/script/SpotifyLyrics.Request.Mac.js',sourceBuffer(previous,'Loon/script/SpotifyLyrics.Request.Mac.js'));
    save('Loon/script/SpotifyLyrics.Entry.Mac.js',Buffer.from(macMetadataRuntime(sourceBuffer(previous,'Loon/script/SpotifyLyrics.Entry.Mac.js').toString(),source)));
    const codec=['utf8Size','putUTF8','utf8','text'].map(name=>{
      const match=source.match(new RegExp('^function '+name+'\\([^]*?^}', 'm'));
      if(!match)throw Error('Missing shared Mac codec: '+name);return match[0];
    }).join('\n');
    const lyrics=readFileSync(join(stage,'runtime/Loon/script/SpotifyLyrics.js'),'utf8');
    const wrapped='(function(hostDone){\nconst LIMIT=262144;let TEXT_UNITS;\n'+codec+'\n'+macDisplay.toString()+'\nconst $done=output=>hostDone(macDisplay($response,output,typeof $argument==="undefined"?{}:$argument,{text,utf8}));\n'+lyrics+'\n})($done);\n';
    save('Loon/script/SpotifyLyrics.Mac.js',Buffer.from(macLyricsRuntime(wrapped)));
    const versionAction = 'src/spotify-versions.js';
    const isrcParser = source.match(/^function catalogISRC\([^]*?^}/m);
    if (!isrcParser) throw Error('Missing recording identifier parser');
    save('Loon/script/SpotifyLyrics.Versions.js',Buffer.from(isrcParser[0]+'\n'+readFileSync(join(root,versionAction),'utf8')));
    for(const path of [versionAction,'src/mac-metadata.mjs','src/mac-network.mjs','tools/mac-runtime.mjs','tools/mac-metadata-cache.mjs','Loon/Development/SpotifyMacMetadata20261114/mac-fallback-compat.mjs','Loon/Development/SpotifyMacMetadata20261114/candidate-codec.mjs','Loon/Development/SpotifyMacMetadata20261114/bounded-json.mjs'])inputs.push({path,sha256:sha(readFileSync(join(root,path)))});
    const manifest={schema:1,core:'3.2.2',patch:'recording-identity-and-version-lookup',inputs,macPresentationSHA256:sha(Buffer.from(macDisplay.toString())),artifacts:artifacts.sort((a,b)=>a.path.localeCompare(b.path))};
    mkdirSync(stage,{recursive:true});writeFileSync(join(stage,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    return {stage,manifest};
  } finally {rmSync(scratch,{recursive:true,force:true});}
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url) {
  const result=compileRuntime();console.log(JSON.stringify({stage:result.stage,artifacts:result.manifest.artifacts.length,published:false}));
}
