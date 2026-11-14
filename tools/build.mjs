import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {setDisplayName} from './display-name.mjs';
import {verifySnapshots} from './source-snapshot.mjs';
import {relocateProfile,runtimeRelease,verifyRuntimeArtifacts} from './runtime-release.mjs';
import {compileRuntime} from './compile-runtime.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
verifySnapshots();
const recovery=JSON.parse(readFileSync(join(root,'provenance/recovery-manifest.json')));
for(const f of recovery.files)if(sha(readFileSync(join(root,'history/3.2.2',f.path)))!==f.sha256)throw Error('Historical source changed: '+f.path);
const {stage,manifest}=compileRuntime(root);
// Validate the complete staged build before changing any active import/runtime
// file. A source edit needs a reviewed immutable runtime snapshot and new pin.
for(const pin of runtimeRelease.artifacts){
  const candidate=manifest.artifacts.find(a=>a.path===pin.path);
  if(!candidate||candidate.bytes!==pin.bytes||candidate.sha256!==pin.sha256)throw Error('Current runtime differs from the immutable pin; review build/current-runtime before adopting a new snapshot: '+pin.path);
}
for(const item of manifest.artifacts){
  const path=join(root,item.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,readFileSync(join(stage,'runtime',item.path)));
}
for(const [client,extension] of Object.entries({Surge:'sgmodule',Egern:'yaml',QuantumultX:'conf',Shadowrocket:'sgmodule'})){
  const path=client+'/script/SpotifyLyrics.'+extension;
  writeFileSync(join(root,path),relocateProfile(setDisplayName(readFileSync(join(root,'provenance/compatibility',path),'utf8'),client)));
}
// Historical native diagnostic packages stay reproducible from their original
// snapshots. Current install files above use the maintained shared source.
execFileSync(process.execPath,['build-mac.mjs'],{cwd:join(root,'Loon/Development/SpotifyMac20261114'),stdio:'pipe'});
for(const args of [['artifacts'],['profile',runtimeRelease.revision]])execFileSync(process.execPath,['build-subscription.mjs',...args],{cwd:join(root,'Loon/Development/SpotifySubscription20261114'),stdio:'pipe'});
for(const script of ['build-candidate.mjs','build-compat.mjs','build-repair.mjs','build-observer.mjs'])execFileSync(process.execPath,['Loon/Development/SpotifyMacMetadata20261114/'+script],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['Loon/Development/SpotifyMac20261114/build-strict-diagnosis.mjs'],{cwd:root,stdio:'pipe'});
verifyRuntimeArtifacts();
mkdirSync(join(root,'evidence'),{recursive:true});
writeFileSync(join(root,'evidence/build.json'),JSON.stringify({core:'3.2.2',patch:'non-chinese-translation',displayName:'SpotifyLyrics',inputs:'maintained src/build.mjs and shared core; local source snapshots for historical diagnostics; no parent Git lookup',network:'none',runtimeRepository:runtimeRelease.repository,runtimeCommit:runtimeRelease.revision,subscriptionURLsChanged:true,artifacts:manifest.artifacts,sourceInputs:manifest.inputs},null,2)+'\n');
console.log(JSON.stringify({built:manifest.artifacts.length,core:'3.2.2',patch:'non-chinese-translation',published:false}));
