import {debugWrap} from './debug-wrap.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const code=readFileSync(new URL('./runtime/SpotifyLyrics.Entry.Mac.js',import.meta.url),'utf8');
const uri='spotify:track:76XUZSb13QUuj1HECY4Hvo';
const vi=v=>{const a=[];do{a.push((v&127)|(v>127?128:0));v=Math.floor(v/128);}while(v);return Buffer.from(a);};
const bin=(n,b)=>Buffer.concat([vi(n*8+2),vi(b.length),b]);
const txt=(n,s)=>bin(n,Buffer.from(s));
const flag=v=>bin(3,Buffer.concat([txt(1,'has_lyrics'),txt(2,v)]));
const track=v=>bin(3,bin(7,Buffer.concat([txt(1,uri),flag(v),txt(91,'SECRET_BODY')])));
function run(core,body,headers={}){
  const output=[],events=[];
  vm.runInNewContext(debugWrap(core,'entry'),{
    $request:{url:'https://spclient.wg.spotify.com/connect-state/v1/devices/private_test_device_12345?private=SECRET_QUERY',method:'PUT',headers:{Authorization:'SECRET_AUTH'}},
    $response:{status:200,body:new Uint8Array(body),headers:{Cookie:'SECRET_COOKIE',...headers}},$argument:{},
    $persistentStore:{read(){},write(){return true;}},$done:v=>output.push(v),console:{log(){}},
    $httpClient:{post(options,callback){
      assert.equal(options.url,'http://127.0.0.1:18765/events');
      assert.equal(options.timeout,300);assert.equal(options.node,'DIRECT');
      assert.ok(Buffer.byteLength(options.body)<4096);assert.ok(!options.body.includes('SECRET'));
      events.push(JSON.parse(options.body));callback(null,{status:204},'');callback(null,{status:204},'');
    },get(){throw Error('Entry must not fetch a lyric source');}}
  },{timeout:1000});
  assert.equal(output.length,1);assert.equal(events.length,2);
  return {output:output[0],events,flags:events.map(e=>Object.fromEntries(e.flags.map(f=>[f.path,f.value])))};
}
test('actual packaged Entry: paired input false and output true belong to the public test track',()=>{
  const {output,events,flags}=run(code,track('false'));
  assert.deepEqual(Buffer.from(output.body),track('true'));
  assert.equal(events[0].route,'connect-state');assert.equal(events[1].route,'connect-state');
  assert.equal(events[0].method,'PUT');assert.equal(events[1].method,'PUT');
  assert.equal(flags[0].run,flags[1].run);assert.match(flags[0].run,/^[a-z0-9]+-[a-z0-9]{1,8}$/);
  assert.equal(flags[0]['3.7.3'],false);assert.equal(flags[1]['3.7.3'],true);
  for(const f of flags)assert.equal(f['public-test-track.3.7.1'],true);
});
test('already true packaged Entry is reported unchanged rather than a new repair',()=>{
  const {output,events,flags}=run(code,track('true'));
  assert.equal(output.body,undefined);assert.equal(events[1].format,'unchanged');assert.equal(flags[1]['3.7.3'],true);
});
test('JSON bytes remain explicitly uninspected; no fabricated protobuf availability result',()=>{
  const {flags}=run('$done({body:$response.body});',Buffer.from('{"private":"SECRET_BODY","hasLyrics":false}'),{'Content-Type':'application/json'});
  for(const f of flags){assert.equal(f['structure.jsonInspection'],'not-performed');assert.equal(f['root.valid'],undefined);}
});
test('unknown MIME is categorized without publishing arbitrary header contents',()=>{
  const {flags}=run('$done({body:$response.body});',track('false'),{'Content-Type':'SECRET_TYPE/SECRET_SUBTYPE'});
  assert.equal(flags[0]['header.type'],'absent-or-other');
});
