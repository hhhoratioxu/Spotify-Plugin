import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtimeRelease,validateRelease,runtimeURL,relocateProfile,verifyRuntimeArtifacts} from './runtime-release.mjs';
import {createProfile} from '../Loon/Development/SpotifySubscription20261114/build-subscription.mjs';

const root = new URL('../', import.meta.url);
const entries = {Loon:'lpx',Surge:'sgmodule',Egern:'yaml',QuantumultX:'conf',Shadowrocket:'sgmodule'};

test('runtime pins reject moving branches, wrong repositories, duplicate assets and unsafe paths', () => {
  for (const change of [r=>r.revision='main',r=>r.repository='hhhoratioxu/Proxy',r=>r.artifacts[0].path='../src/spotify-lyrics.js',r=>r.artifacts[1]=r.artifacts[0],r=>r.artifacts[0].sha256='invalid']) {
    const copy=structuredClone(runtimeRelease);change(copy);assert.throws(()=>validateRelease(copy));
  }
  assert.throws(()=>runtimeURL('Loon/script/unknown.js'));
});

test('all eighteen relocated runtime and notice files retain their bootstrap hashes', () => {
  assert.equal(verifyRuntimeArtifacts(),18);
});

test('every native installation script resolves to the same independent immutable release', () => {
  const used = new Set();
  for (const [client,extension] of Object.entries(entries)) {
    const profile=readFileSync(new URL(client+'/script/SpotifyLyrics.'+extension,root),'utf8');
    assert.doesNotMatch(profile,/https:\/\/(?:raw\.githubusercontent\.com|github\.com)\/hhhoratioxu\/Proxy\//);
    assert.doesNotMatch(profile,/127\.0\.0\.1|localhost|\/events|CacheProbe|Debug/);
    const urls=profile.match(/https:\/\/raw\.githubusercontent\.com\/[^\s"',)]+/g)||[];
    assert.ok(urls.length>=2,client);
    for (const value of urls) {
      const url=new URL(value);
      assert.equal(url.origin,'https://raw.githubusercontent.com');
      assert.equal(url.username,'');assert.equal(url.password,'');
      const prefix='/'+runtimeRelease.repository+'/'+runtimeRelease.revision+'/';
      assert.ok(url.pathname.startsWith(prefix),value);
      const path=url.pathname.slice(prefix.length);
      assert.equal(runtimeURL(path),url.origin+url.pathname);
      assert.ok(path.startsWith(client+'/script/'));
      used.add(path);
    }
  }
  assert.deepEqual([...used].sort(),runtimeRelease.artifacts.filter(a=>a.path.endsWith('.js')).map(a=>a.path).sort());
});

test('relocation preserves native URL fragments, query values and surrounding options', () => {
  const source='script-path=https://raw.githubusercontent.com/hhhoratioxu/Proxy/'+'1'.repeat(40)+'/Surge/script/SpotifyLyrics.js?v=3.2.2#TARGET_LANGUAGE=zh-CN,timeout=12,engine=webview';
  assert.equal(relocateProfile(source),'script-path='+runtimeURL('Surge/script/SpotifyLyrics.js')+'?v=3.2.2#TARGET_LANGUAGE=zh-CN,timeout=12,engine=webview');
  assert.throws(()=>relocateProfile(source.replace('SpotifyLyrics.js','Unrelated.js')));
});

test('Loon builder refuses a runtime pin that has not been verified for this independent release', () => {
  assert.throws(()=>createProfile('795c677b0d115cab5eb8e4f959424d905a98e3ff'));
  assert.throws(()=>createProfile('main'));
});

test('migration retains a documented Spotify-only Git history and old-to-new commit map', () => {
  const history=JSON.parse(readFileSync(new URL('provenance/git-history.json',root),'utf8'));
  assert.equal(history.commits,101);assert.equal(history.commitMap.length,history.commits);
  assert.equal(history.historicalPaths,3179);
  assert.equal(history.unrelatedProjectFilesIncluded,false);
  assert.ok(history.pathSelectors.every(p=>/SpotifyLyrics|VerseLyrics/i.test(p)));
  assert.equal(new Set(history.commitMap.map(c=>c.original)).size,history.commits);
  assert.equal(new Set(history.commitMap.map(c=>c.migrated)).size,history.commits);
  for (const item of history.commitMap) for(const value of Object.values(item)) assert.match(value,/^[0-9a-f]{40}$/);
});
