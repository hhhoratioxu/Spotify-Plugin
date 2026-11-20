import assert from 'node:assert/strict';
import vm from 'node:vm';
import {baseline} from './build-subscription.mjs';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';

// Reuse the baseline's independent interpreter for the documented conditional
// subset. This is not a claim to run Loon's native configuration parser.
const fixture=sourceBuffer(baseline,'Surge/Development/VerseLyrics322/loon-rewrite.test.mjs').toString();
const interpreter=fixture.slice(fixture.indexOf('function condition('),fixture.indexOf('function values('));
assert.ok(interpreter.includes('function condition('));
const condition=vm.runInNewContext(interpreter+'\ncondition',{assert});
const defaults={CLIENT_PLATFORM:'mobile',TRANSLATION_ENABLED:true,TARGET_LANGUAGE:'zh-CN',FALLBACK_PROVIDER:'auto',DISCOVER_MISSING:true};
export function selectLoonRules(lines,{mode='mobile',url='https://spclient.wg.spotify.com/color-lyrics/v2/track/0000000000000000000001',method='GET',status=200,length='20',internal=null,contentType=null,encoding=null,transfer=null,marker=null,env={}}={}){
  const values=k=>{
    if(k==='url')return url;if(k==='request.method')return method;if(k==='response.status')return status;
    if(k==="request.header['x-verselyrics-internal']")return internal;
    if(k==="response.header['Content-Length']")return length;
    if(k==="response.header['Content-Type']")return contentType;
    if(k==="response.header['Content-Encoding']")return encoding;
    if(k==="response.header['Transfer-Encoding']")return transfer;
    if(k==="response.header['x-verselyrics']")return marker;
    if(k.startsWith('request.header[')||k.startsWith('response.header['))return null;
    assert.ok(Object.hasOwn(defaults,k));return k==='CLIENT_PLATFORM'?mode:Object.hasOwn(env,k)?env[k]:defaults[k];
  };
  return lines.filter(line=>condition(line.slice(line.indexOf(' if ')+4,line.indexOf(' then ')),values));
}
