import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
test('all 125 recovered files still match their exact Git blobs',()=>{
  const m=JSON.parse(readFileSync(new URL('recovery-manifest.json',root)));
  assert.equal(m.files.length,125);
  for(const f of m.files)assert.equal(createHash('sha256').update(readFileSync(new URL(m.restoredPrefix+f.path,root))).digest('hex'),f.sha256,f.path);
});
test('the distributed artifacts match the build manifest and compile',()=>{
  const manifest=JSON.parse(readFileSync(new URL('dist/runtime-manifest.json',root)));
  for(const f of manifest){const data=readFileSync(new URL('dist/'+f.path,root));assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256);if(f.path.endsWith('.js')&&!f.path.startsWith('Egern/'))new vm.Script(data.toString());}
});
for(const [client,ext] of [['Loon','lpx'],['Surge','sgmodule']])test(`${client}: actual local import references only existing lowercase script paths`,()=>{
  const cfg=readFileSync(new URL(`dist/${client}/script/SpotifyLyrics.${ext}`,root),'utf8');
  const base=JSON.parse(readFileSync(new URL('dist/import-manifest.json',root))).find(m=>m.path===`${client}/script/SpotifyLyrics.${ext}`).assetBase;
  const refs=[...cfg.matchAll(/(?:script\("|script-path=)(https?:\/\/[^\s",)]+)/g)].map(m=>{assert.ok(m[1].startsWith(base));return m[1].slice(base.length);});
  assert.equal(refs.length,client==='Loon'?2:3);
  for(const ref of refs){assert.ok(ref.startsWith(client+'/script/'));assert.ok(existsSync(new URL('dist/'+ref,root)));assert.ok(!ref.includes('/Script/'));}
  assert.ok(cfg.includes('本地候选（未发布）'));
  if(client==='Loon'){
    assert.match(cfg,/#!loon_version = 3\.5\.1\(983\)/);assert.ok(!cfg.includes('script-path='));
    const rules=cfg.split('\n').filter(l=>l.startsWith('response if '));assert.equal(rules.length,2);
    for(const rule of rules){assert.match(rule,/requires_body=true, binary_body_mode=true/);assert.match(rule,/\$\{url\} ~=/);assert.equal((rule.match(/then script\(/g)||[]).length,1);assert.match(rule,/\$\{FALLBACK_PROVIDER\} ~= \/\^\(\?:a\^\)\$\//);}
    assert.ok(!cfg.includes('max_size=')&&!cfg.includes('engine='));
    assert.ok(cfg.includes('FALLBACK_OFFSET_MS = select,0,-500,500,-1000,1000,type=number'));
  }else{
    assert.match(cfg,/binary-body-mode=true/);assert.match(cfg,/engine=webview/);assert.match(cfg,/FALLBACK_PROVIDER=off/);
  }
});
