// Complete only a field consumed unconditionally by this desktop hook.
// Scope: our own fallback after 404 or a strictly recognized empty 200, JSON only.
export function macFallbackCompat(response,output,codec){
  try{
    const upstream=Number(response?.status);
    if(![200,404].includes(upstream)||Number(output?.status)!==200||!output?.headers)return output;
    if(upstream===200){
      const types=Object.keys(response.headers||{}).filter(k=>k.toLowerCase()==='content-type');
      if(types.length!==1||!/^application\/json(?:\s*;.*)?$/i.test(String(response.headers[types[0]])))return output;
      const body=response.body;
      if(typeof body!=='string'&&(!ArrayBuffer.isView(body)||body.byteLength>262144))return output;
      if(typeof body==='string'&&body.length>262144)return output;
      const input=typeof body==='string'?body:codec.text(new Uint8Array(body.buffer,body.byteOffset,body.byteLength));codec.utf8Size(input,262144);
      const original=codec.scanJSON(input).doc,l=original.lyrics;
      if(!l||!['LINE_SYNCED','UNSYNCED'].includes(l.syncType)||!Array.isArray(l.lines)||l.lines.length!==0)return output;
      if(Object.hasOwn(l,'previewLines')&&(!Array.isArray(l.previewLines)||l.previewLines.length))return output;
      if(original.showUpsell===true||l.showUpsell===true||['capStatus','cap_status','restriction','content_access_status','contentAccessStatus'].some(key=>Object.hasOwn(l,key)||Object.hasOwn(original,key)))return output;
    }
    const get=name=>{const keys=Object.keys(output.headers).filter(k=>k.toLowerCase()===name);return keys.length===1?String(output.headers[keys[0]]):'';};
    if(get('x-verselyrics')!=='3.2.2'||!/^application\/json(?:\s*;.*)?$/i.test(get('content-type')))return output;
    const body=output.body;if(typeof body!=='string'&&(!ArrayBuffer.isView(body)||body.byteLength>262144))return output;
    if(typeof body==='string'&&body.length>262144)return output;
    const input=typeof body==='string'?body:codec.text(new Uint8Array(body.buffer,body.byteOffset,body.byteLength));codec.utf8Size(input,262144);
    const {doc,members}=codec.scanJSON(input),l=doc.lyrics;
    if(!l||Array.isArray(l)||!codec.providers.includes(l.provider)||Object.hasOwn(l,'previewLines')||!['LINE_SYNCED','UNSYNCED'].includes(l.syncType)||!Array.isArray(l.lines)||!l.lines.length||l.lines.length>600)return output;
    if(l.lines.some(row=>!row||typeof row.words!=='string'||typeof row.startTimeMs!=='string'||!/^\d+$/.test(row.startTimeMs)||Number(row.startTimeMs)>86400000||row.syllables&&(!Array.isArray(row.syllables)||row.syllables.length)))return output;
    const end=members.lyrics?.[1];if(!end||input[end-1]!=='}')return output;
    const text=input.slice(0,end-1)+',"previewLines":[]'+input.slice(end-1);
    const encoded=typeof body==='string'?(codec.utf8Size(text,262144),text):codec.utf8(text,262144);
    const headers={...output.headers};for(const key of Object.keys(headers))if(['content-length','content-encoding','etag','content-md5','digest','last-modified'].includes(key.toLowerCase()))delete headers[key];
    return {...output,headers,body:encoded};
  }catch{return output;}
}
