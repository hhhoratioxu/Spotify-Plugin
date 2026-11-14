import test from 'node:test';
import assert from 'node:assert/strict';
import {singleTrackFlags} from './strict-metadata-flags.mjs';
const gid=Buffer.concat([Buffer.from([10,16]),Buffer.from('e9b099ff35ac4a9ab73e0e14d20b67a6','hex')]);
for(const [value,expected] of [[0,false],[1,true],[2,'unknown']])test('metadata field18 diagnostic value '+value,()=>{
  assert.deepEqual(singleTrackFlags(Buffer.concat([gid,Buffer.from([144,1,value])])),{publicTargetMatched:true,lyricsFlags:[expected]});
});
test('missing flag is explicitly omitted, not false',()=>assert.deepEqual(singleTrackFlags(gid),{publicTargetMatched:true,lyricsFlags:['omitted']}));
test('noncanonical valid boolean varint retains its semantic value',()=>assert.deepEqual(singleTrackFlags(Buffer.concat([gid,Buffer.from([144,1,129,0])])).lyricsFlags,[true]));
for(const input of [Buffer.from([255]),Buffer.concat([gid,gid]),Buffer.concat([gid,Buffer.from([144,1,0,144,1,1])]),Buffer.concat([gid,Buffer.from([146,1,0])]),Buffer.alloc(131073)])test('ambiguous/malformed/oversize metadata never fabricates a flag: '+input.length,()=>assert.deepEqual(singleTrackFlags(input).lyricsFlags,['unknown']));
test('unknown uint64 and opaque private fields are skipped without decoding',()=>{
  const opaque=Buffer.from('PRIVATE_FIXTURE_METADATA');const body=Buffer.concat([gid,Buffer.from([72,255,255,255,255,255,255,255,255,255,1]),Buffer.from([18,opaque.length]),opaque,Buffer.from([144,1,1])]);
  assert.deepEqual(singleTrackFlags(body),{publicTargetMatched:true,lyricsFlags:[true]});
});
test('an unrelated valid gid is not reported as the public target',()=>assert.equal(singleTrackFlags(Buffer.concat([Buffer.from([10,16]),Buffer.alloc(16)])).publicTargetMatched,false));
test('overflowing uint64 prevents a false valid-envelope report',()=>{
  const body=Buffer.concat([gid,Buffer.from([72,255,255,255,255,255,255,255,255,255,127,144,1,1])]);assert.deepEqual(singleTrackFlags(body).lyricsFlags,['unknown']);
});
