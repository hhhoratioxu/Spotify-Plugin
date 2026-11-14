// Deliberately no installer, listener, network request, UI or playback action.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {sourceBuffer,verifySnapshots} from './source-snapshot.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='Loon/Development/SpotifyMac20261114/';
const manifest=JSON.parse(readFileSync(join(root,base,'strict/manifest.json')));
const report={recordedAt:new Date().toISOString(),timeZone:'Asia/Taipei',scope:'Strict B offline preflight only',success:false,steps:[],performed:{ui:false,playback:false,listener:false,pluginChange:false,networkSettingsChange:false,push:false},nativeRestorationReady:false};
const sha=b=>createHash('sha256').update(b).digest('hex');
try{
  report.sourceSnapshotObjects=verifySnapshots();
  report.artifacts=manifest.files.map(item=>{
    const bytes=readFileSync(join(root,base,'strict',item.file));
    if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)throw Error('Artifact changed: '+item.file);
    if(item.productionSource){
      const original=sourceBuffer(manifest.productionMacCommit,'Loon/script/'+item.productionSource);
      if(sha(original)!==item.productionSHA256||!bytes.includes(original))throw Error('Production core changed: '+item.productionSource);
      if(!readFileSync(join(root,'Loon/script',item.productionSource)).equals(original))throw Error('Working production runtime changed: '+item.productionSource);
    }
    return {kind:item.kind,sha256:item.sha256,productionCorePreserved:item.productionSource?true:undefined,workingProductionRuntimeUnchanged:item.productionSource?true:undefined};
  });
  report.profileSHA256=report.artifacts.find(f=>f.kind==='profile').sha256;
  report.fields=manifest.fields;
  const expected=['route','stage','pair','publicTargetMatched','lyricsFlags'];
  if(JSON.stringify(manifest.fields)!==JSON.stringify(expected)||manifest.productionCoreChanged||manifest.newFixCandidatesIncluded||manifest.profileRulesChanged)throw Error('Unexpected diagnostic scope');
  function command(label,binary,args){
    const result=spawnSync(binary,args,{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
    report.steps.push({label,exitCode:result.status});
    if(result.status!==0)throw Error(label+': '+(result.stderr||result.stdout||result.error||'failed'));
    return {stdout:result.stdout||'',stderr:result.stderr||''};
  }
  const tests=command('script-and-baseline-guards',process.execPath,['--test','--test-reporter=tap',base+'strict-diagnosis.test.mjs',base+'strict-metadata-flags.test.mjs',base+'strict-input.test.mjs',base+'strict-json-flags.test.mjs',base+'public-target-request.test.mjs','tools/migration.test.mjs']);
  const count=re=>Number(tests.stdout.match(re)?.[1]||0);
  report.node={tests:count(/# tests (\d+)/),passed:count(/# pass (\d+)/),failed:count(/# fail (\d+)/),skipped:count(/# skipped (\d+)/)};
  // Block socket construction even if a future receiver test regresses.
  const python=command('receiver-with-sockets-disabled','python3',['-c',
    "import socket,unittest,http.server; from unittest.mock import patch;\nwith patch('socket.socket',side_effect=AssertionError('Network disabled in preflight')):\n suite=unittest.defaultTestLoader.discover('"+base+"',pattern='strict_server_test.py')\n result=unittest.TextTestRunner().run(suite)\nraise SystemExit(0 if result.wasSuccessful() else 1)"]);
  report.receiver={tests:Number((python.stdout+python.stderr).match(/Ran (\d+) tests?/)?.[1]||0),success:true,socketsDisabled:true};
  report.recoveryRehearsal=JSON.parse(command('synthetic-recovery-rehearsal','python3',[base+'recovery_drill.py']).stdout);
  report.resources={exclusive:['Mac UI','Loon configuration and shared script cache'],nativeWindowMinutes:10,loopbackEndpoint:'127.0.0.1:18765',listenerMaximumSeconds:600,artifacts:4,
    prerequisites:['New explicit UI and Loon release','Fresh snapshot of both actual configurations and script-cache content/index from that window','Current parameter/reference inventory','Local-device mute/volume-zero verification'],livePrerequisitesChecked:false};
  report.success=true;
}catch(error){report.error=String(error.message||error);process.exitCode=1;}
mkdirSync(join(root,'evidence'),{recursive:true});writeFileSync(join(root,'evidence/b-offline-preflight.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
