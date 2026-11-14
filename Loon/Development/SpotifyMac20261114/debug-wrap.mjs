// A temporary, local-only wrapper; never part of the response core.
import {availabilityMapPaths} from './protocol-shape.mjs';
import {metadataShape} from './metadata-shape.mjs';
import {diagnosticRoute} from './diagnostic-route.mjs';
export function debugWrap(core,kind){
  if(!['lyrics','entry'].includes(kind))throw Error('invalid kind');
  return `(function(hostDone){
${availabilityMapPaths.toString()}
${metadataShape.toString()}
${diagnosticRoute.toString()}
let started=false,finished=false;
const runId=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);
const publicTestURI="spotify:track:76XUZSb13QUuj1HECY4Hvo";
function facts(input){
  if(typeof input==="string")return [{path:"structure.textInspection",value:"not-performed"}];
  if(!ArrayBuffer.isView(input)||input.byteLength>131072)return [];
  let i=0;while(i<input.length&&[9,10,13,32].includes(input[i]))i++;
  if(input[i]===123||input[i]===91)return [{path:"structure.jsonInspection",value:"not-performed"}];
  return diagnosticRoute($request).route==="extended-metadata"?metadataShape(input,publicTestURI):availabilityMapPaths(input,true,publicTestURI);
}
function summary(output){
  const incoming=$response.body, body=output&&output.body;
  const event={phase:"${kind}",...diagnosticRoute($request),status:Number($response.status),bytes:incoming?incoming.length:0,format:body===undefined?"unchanged":typeof body==="string"?"string":"bytes",flags:[{path:"run",value:runId},...facts(body===undefined?incoming:body)]};
  if(output&&output.status!==undefined)event.outputStatus=Number(output.status);
  if(body!==undefined)event.outputBytes=body.length;
  return event;
}
function report(event,next){
  let called=false;function resume(){if(!called){called=true;next();}}
  // These fields contain ASCII categories, numbers and booleans only. Keep
  // paired events within the receiver's existing 4 KiB input boundary.
  while(JSON.stringify(event).length>3800&&event.flags?.length>1)event.flags.pop();
  try{$httpClient.post({url:"http://127.0.0.1:18765/events",headers:{"Content-Type":"application/json"},body:JSON.stringify(event),timeout:300,node:"DIRECT","auto-cookie":false,"auto-redirect":false,"binary-mode":false,insecure:false},resume);}catch{resume();}
}
const $done=output=>{if(finished)return;finished=true;let event;try{event=summary(output);}catch{event={phase:"${kind}",route:"other",format:"summary-error"};}report(event,()=>hostDone(output));};
function start(){if(started)return;started=true;\n${core}\n}
const incoming=$response.body;let first=0;if(incoming&&ArrayBuffer.isView(incoming)){while(first<incoming.length&&[9,10,13,32].includes(incoming[first]))first++;}
const shape=[{path:"body.json",value:typeof incoming==="string"&&/^\\s*[{[]/.test(incoming)||Boolean(incoming&&incoming[first]===123)},{path:"body.gzip",value:Boolean(incoming&&incoming[0]===31&&incoming[1]===139)},{path:"body.view",value:ArrayBuffer.isView(incoming)}];
const headers=$response.headers||{},typeKey=Object.keys(headers).find(k=>k.toLowerCase()==="content-type"),encodingKey=Object.keys(headers).find(k=>k.toLowerCase()==="content-encoding");
shape.push({path:"header.json",value:/json/i.test(headers[typeKey]||"")},{path:"header.protobuf",value:/protobuf|octet-stream/i.test(headers[typeKey]||"")},{path:"header.encoding",value:/^(gzip|deflate|br|zstd)$/.test(headers[encodingKey]||"")?headers[encodingKey]:"other-or-absent"});
let mime=headers[typeKey];if(Array.isArray(headers)){const row=headers.find(x=>String(x.field||x.name||x.key||"").toLowerCase()==="content-type");mime=row?.value;}
const base=String(mime||"").split(";",1)[0].trim().toLowerCase();shape.push({path:"header.shape",value:Array.isArray(headers)?"array":typeof headers},{path:"header.type",value:["application/json","application/protobuf","application/x-protobuf","application/octet-stream"].includes(base)?base:"absent-or-other"});
report({phase:"${kind}-enter",...diagnosticRoute($request),status:Number($response.status),bytes:incoming?incoming.length:0,flags:[{path:"run",value:runId},...shape,...facts(incoming)]},start);
})($done);\n`;
}
