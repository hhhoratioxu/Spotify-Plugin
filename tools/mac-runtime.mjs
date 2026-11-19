import {macMetadataEntry} from '../src/mac-metadata.mjs';
import {macTrackStorage} from '../src/mac-network.mjs';
import {macFallbackCompat} from '../Loon/Development/SpotifyMacMetadata20261114/mac-fallback-compat.mjs';
import {candidateCodec} from '../Loon/Development/SpotifyMacMetadata20261114/candidate-codec.mjs';
import {macMetadataCacheRuntime} from './mac-metadata-cache.mjs';

export function macMetadataRuntime(entry,source) {
  return '(function(hostDone){\n'+candidateCodec(131072)+macMetadataEntry.toString()+'\n'+macMetadataCacheRuntime(source)+`
let patched;try{patched=macMetadataEntry($request,$response,nativeArguments(),{settings,utf8Size,utf8,text,scanJSON:boundedJSON,remember:macRememberMetadata});}catch{}
if(patched){hostDone(patched);return;}
const $done=hostDone;
`+entry+'\n})($done);\n';
}

export function macNetworkRuntime(lyrics) {
  return '(function(hostStore){\n'+macTrackStorage.toString()+'\nconst $persistentStore=macTrackStorage(hostStore,typeof $request==="undefined"?null:$request?.url);\n'+lyrics+'\n})($persistentStore);\n';
}

export function macLyricsRuntime(lyrics) {
  const body='(function(hostDone){\n'+candidateCodec(262144)+macFallbackCompat.toString()+`
const $done=result=>hostDone(macFallbackCompat($response,result,{utf8Size,utf8,text,scanJSON:boundedJSON,providers:Object.keys(SOURCES)}));
`+lyrics+'\n})($done);\n';
  return macNetworkRuntime(body);
}
