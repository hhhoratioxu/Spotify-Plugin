import {availabilityMapPaths} from './protocol-shape.mjs';
import {metadataShape} from './metadata-shape.mjs';
import {diagnosticRoute} from './diagnostic-route.mjs';
import {singleTrackFlags} from './strict-metadata-flags.mjs';
import {strictDiagnosticInput} from './strict-input.mjs';
import {strictJSONFlags} from './strict-json-flags.mjs';
import {publicTargetRequest} from './public-target-request.mjs';

// B instrumentation only. Keep the production script byte-for-byte inside it.
// No status, method, sizes, MIME, schema paths, text or timestamp is reported.
export function strictDebugWrap(core,kind){
  if(!['entry','lyrics'].includes(kind))throw Error('Unknown diagnostic kind');
  return `(function(hostDone){
${availabilityMapPaths.toString()}
${metadataShape.toString()}
${diagnosticRoute.toString()}
${singleTrackFlags.toString()}
${strictDiagnosticInput.toString()}
${strictJSONFlags.toString()}
${publicTargetRequest.toString()}
const pair=Array.from({length:16},()=>Math.floor(Math.random()*16).toString(16)).join("");
const target="spotify:track:76XUZSb13QUuj1HECY4Hvo";
let started=false,finished=false;
function event(stage,input){
  const route=diagnosticRoute($request).route;
  let raw=[];
  try{const normalized=strictDiagnosticInput(input);if(normalized){
    if(normalized.text!==null){const result=strictJSONFlags(normalized.text,route);return {route,stage,pair,publicTargetMatched:publicTargetRequest($request)||result.publicTargetMatched,lyricsFlags:result.lyricsFlags};}
    const bytes=normalized.bytes;
      if(route==="metadata"){const result=singleTrackFlags(bytes);return {route,stage,pair,publicTargetMatched:publicTargetRequest($request)||result.publicTargetMatched,lyricsFlags:result.lyricsFlags};}
      raw=route==="extended-metadata"?metadataShape(bytes,target):availabilityMapPaths(bytes,true,target);
  }}catch{}
  const publicTargetMatched=publicTargetRequest($request)||raw.some(f=>(f.path.startsWith("public-test-track.")||/\\.publicTestTrack$/.test(f.path))&&f.value===true);
  const lyricsFlags=raw.filter(f=>/^\\d+(?:\\.\\d+)*$/.test(f.path)||/^metadata\\.\\d+\\.hasLyrics$/.test(f.path)).map(f=>f.value===true||f.value==="true"?true:f.value===false||f.value==="false"?false:f.value==="omitted"?"omitted":"unknown").slice(0,16);
  if(!lyricsFlags.length)lyricsFlags.push("unknown");
  return {route,stage,pair,publicTargetMatched,lyricsFlags};
}
function report(data,next){
  let called=false;const resume=()=>{if(!called){called=true;next();}};
  try{$httpClient.post({url:"http://127.0.0.1:18765/events",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),timeout:300,node:"DIRECT","auto-cookie":false,"auto-redirect":false,"binary-mode":false,insecure:false},resume);}catch{resume();}
}
function start(){if(started)return;started=true;
${core}
}
const $done=output=>{if(finished)return;finished=true;let data;try{data=event("after",output&&output.body!==undefined?output.body:$response.body);}catch{data={route:"other",stage:"after",pair,publicTargetMatched:false,lyricsFlags:["unknown"]};}report(data,()=>hostDone(output));};
let first;try{first=event("before",$response.body);}catch{first={route:"other",stage:"before",pair,publicTargetMatched:false,lyricsFlags:["unknown"]};}
report(first,start);
})($done);\n`;
}
