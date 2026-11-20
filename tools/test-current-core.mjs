import {cpSync,readFileSync,writeFileSync,mkdirSync,mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
// Original assertions incompatible with the user's new policy are named
// explicitly, not edited in history or treated as production defects. Their
// replacement expectations are covered by translation-policy/native tests.
const superseded=[
  'zh-CN: useful mixed cache, including source provenance, stays warm',
  'zh-TW: useful mixed cache, including source provenance, stays warm',
  'Chinese text still translates to an explicitly selected foreign target',
  'qq: mixed Chinese/English source keeps originals without any translation',
  'netease: mixed Chinese/English source keeps originals without any translation',
  'complete translation failure removes every official JSON alternative and retains original lyrics',
  'complete translation failure removes all protobuf alternatives and preserves every non-translation byte',
  'explicit source and compatible letters only: zh -> ja, 海面'
];
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const scratch=mkdtempSync(join(tmpdir(),'spotifylyrics-current-core-'));
try {
  cpSync(join(root,'history/3.2.2/core'),join(scratch,'core'),{recursive:true});
  const source=readFileSync(join(root,'src/spotify-lyrics.js'),'utf8');
  writeFileSync(join(scratch,'core/spotify-lyrics.js'),source);
  // The archived tests remain byte-identical. In the current-core copy,
  // current negatives use the maintained revision and legacy negatives
  // retain their original revision. The captured track now includes its ISRC.
  const currentRevision=source.match(/^const SOURCE_REVISION = (\d+);$/m)?.[1];
  if (!currentRevision) throw Error('Missing current lyrics source revision');
  function adaptFixture(name,from,to) {
    const path=join(scratch,'core/test',name),fixture=readFileSync(path,'utf8');
    if (fixture.split(from).length!==2) throw Error('Unexpected compatibility fixture: '+name);
    writeFileSync(path,fixture.replace(from,to));
  }
  for (const name of ['bilingual-artists','cache-latency','static-source-repair']) {
    adaptFixture(name+'.test.mjs','sourceRevision:8','sourceRevision:'+currentRevision);
  }
  adaptFixture('spotify-lyrics.test.mjs','duration:targetFixture.expected.duration});',
    'duration:targetFixture.expected.duration,isrc:"HKD012995812"});');
  writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
  cpSync(join(root,'build/current-runtime/runtime'),join(scratch,'runtime'),{recursive:true});
  writeFileSync(join(scratch,'request-core.js'),readFileSync(join(root,'build/current-runtime/request-core.js')));
  const files=readdirSync(join(scratch,'core/test')).filter(n=>n.endsWith('.test.mjs')).map(n=>'core/test/'+n);
  const result=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-skip-pattern=^(?:'+superseded.map(escape).join('|')+')$',...files],{cwd:scratch,encoding:'utf8',maxBuffer:16*1024*1024});
  const count=pattern=>Number(result.stdout.match(pattern)?.[1]||0);
  const report={recordedAt:new Date().toISOString(),scope:'Original core test files executed against the current maintained source and staged native runtimes in a temporary directory; history files unchanged',tests:count(/# tests (\d+)/),passed:count(/# pass (\d+)/),failed:count(/# fail (\d+)/),skipped:count(/# skipped (\d+)/),excludedByRequestedPolicy:superseded.length,supersededAssertions:superseded,replacementTests:['tools/translation-policy.test.mjs','tools/translation-native.test.mjs'],success:result.status===0};
  mkdirSync(join(root,'evidence'),{recursive:true});writeFileSync(join(root,'evidence/current-core-tests.tap'),result.stdout||'');
  writeFileSync(join(root,'evidence/current-core-summary.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,supersededAssertions:superseded.length}));
  if(result.status!==0){console.error(result.stdout.split('\n').filter(s=>s.startsWith('not ok')).join('\n'));if(result.stderr)console.error(result.stderr);process.exitCode=1;}
} finally {rmSync(scratch,{recursive:true,force:true});}
