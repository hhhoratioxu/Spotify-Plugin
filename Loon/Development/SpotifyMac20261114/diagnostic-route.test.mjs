import {diagnosticRoute} from './diagnostic-route.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const id='76XUZSb13QUuj1HECY4Hvo';
const routes=[
  ['lyrics','color-lyrics/v2/track/'+id+'/image/example'],
  ['extended-metadata','extended-metadata/v0/extended-metadata'],
  ['metadata','metadata/4/track/'+'0'.repeat(32)],
  ['connect-state','connect-state/v1/devices/private_test_device_12345'],
  ['context-resolve','context-resolve/v1/spotify:playlist:private_context'],
  ['player-cards','scrollsita/v1/scroll/spotify%3Atrack%3A'+id],
  ['lyrics-entry','bootstrap/v1/bootstrap']
];
for(const [expected,path] of routes)test('fixed route category: '+expected,()=>{
  for(const host of ['spclient.wg.spotify.com','gew1-spclient.spotify.com:443']){
    const result=diagnosticRoute({url:'https://'+host+'/'+path+'?private=SECRET',method:'POST'});
    assert.deepEqual(result,{route:expected,method:'POST'});
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
});
test('unknown destinations, excessive URLs and missing request stay private',()=>{
  for(const url of [undefined,'https://example.com/color-lyrics/v2/track/'+id,'https://spclient.wg.spotify.com.evil.test/color-lyrics/v2/track/'+id,'https://spclient.wg.spotify.com/private/SECRET','https://spclient.wg.spotify.com/'+('s'.repeat(4100))]){
    assert.deepEqual(diagnosticRoute({url,method:'SECRET'}),{route:'other',method:'other'});
  }
  assert.deepEqual(diagnosticRoute(),{route:'other',method:'other'});
});
