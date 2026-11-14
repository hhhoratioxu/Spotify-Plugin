// Fixed categories only. Raw URL/header values, identifiers and text never exit.
export function metadataObservation(request,response,readBody,codec){
  const id='76XUZSb13QUuj1HECY4Hvo',hex='e9b099ff35ac4a9ab73e0e14d20b67a6';
  const prefix='^https://(?:spclient\\.wg|[a-z0-9-]+-spclient)\\.spotify\\.com(?::443)?/';
  const meta=new RegExp(prefix+'metadata/4/track/'+hex+'(?:\\?[^#\\s]*)?$');
  const lyric=new RegExp(prefix+'color-lyrics/v2/track/'+id+'(?:/image/[^?#\\s]+)?/?(?:\\?[^#\\s]*)?$');
  if(request?.method!=='GET'||typeof request.url!=='string'||request.url.length>4096)return null;
  const route=meta.test(request.url)?'metadata':lyric.test(request.url)?'lyrics':null;if(!route)return null;
  const get=name=>{const keys=Object.keys(response?.headers||{}).filter(k=>k.toLowerCase()===name);return keys.length===1?String(response.headers[keys[0]]):'';};
  const type=get('content-type'),encoding=get('content-encoding').toLowerCase();
  const event={schema:1,route,status:Number.isInteger(Number(response?.status))&&Number(response.status)>=100&&Number(response.status)<=599?Number(response.status):0,
    mime:/json/i.test(type)?'json':/protobuf|octet-stream/i.test(type)?'protobuf':type?'other':'missing',encoding:['identity','gzip','br'].includes(encoding)?encoding:encoding?'other':'missing',
    inspection:'not-read',bytes:-1,flag:'unknown',gidFormat:'not-read',identityMatches:false,namePresent:false,albumPresent:false,artistsPresent:false,durationKind:'not-read',accessFieldPresent:false,candidateWouldPatch:false};
  if(!readBody||route!=='metadata')return event;
  try{
    const body=response?.body;let text,bytes;
    if(typeof body==='string'){if(body.length>131072){event.inspection='over-limit';event.bytes=131073;return event;}event.bytes=codec.utf8Size(body,131072);text=body;}
    else if(ArrayBuffer.isView(body)){event.bytes=Math.min(body.byteLength,131073);if(body.byteLength>131072){event.inspection='over-limit';return event;}bytes=new Uint8Array(body.buffer,body.byteOffset,body.byteLength);}
    else return event;
    if(event.mime==='json'){
      text=text??codec.text(bytes);const {doc}=codec.scanJSON(text);event.inspection='json';
      event.flag=!Object.hasOwn(doc,'has_lyrics')?'missing':doc.has_lyrics===true?'true':doc.has_lyrics===false?'false':doc.has_lyrics===null?'null':'other';
      event.gidFormat=typeof doc.gid!=='string'?'missing':/^[A-Za-z0-9+/]{22}==$/.test(doc.gid)?'base64':/^[0-9a-f]{32}$/.test(doc.gid)?'hex':'other';
      event.identityMatches=doc.gid===hex||doc.gid==='6bCZ/zWsSpq3Pg4U0gtnpg==';
      event.namePresent=typeof doc.name==='string'&&!!doc.name.trim();event.albumPresent=typeof doc.album?.name==='string'&&!!doc.album.name.trim();event.artistsPresent=Array.isArray(doc.artist)&&doc.artist.length>0&&doc.artist.length<=16&&doc.artist.every(a=>typeof a?.name==='string'&&!!a.name.trim());
      event.durationKind=Number.isInteger(doc.duration)&&doc.duration>0?'positive-integer':typeof doc.duration==='string'?'string':doc.duration==null?'missing':'other';
      event.accessFieldPresent=['content_access_status','contentAccessStatus','restriction'].some(k=>Object.hasOwn(doc,k));
      event.candidateWouldPatch=Boolean(codec.candidate(request,response,{},codec));return event;
    }
    if(event.mime==='protobuf'&&bytes){
      let pos=0,count=0,gids=0,flags=0,flag='missing',matches=false;
      const uint=()=>{let n=0;for(let i=0;i<5;i++){if(pos>=bytes.length)throw Error('truncated');const b=bytes[pos++];n+=(b&127)*2**(i*7);if(!(b&128))return n;}throw Error('varint');};
      while(pos<bytes.length){
        if(++count>4096)throw Error('fields');const tag=uint(),field=Math.floor(tag/8),wire=tag%8;if(!field||tag>4294967295)throw Error('tag');
        if(field===18&&wire!==0){flags++;flag='other';}if(field===1&&wire!==2){gids++;matches=false;}
        if(wire===0){let low=-1,start=pos,ended=false;for(let n=0;n<10;n++){if(pos>=bytes.length)throw Error('truncated');const b=bytes[pos++];if(n===0)low=b;if(!(b&128)){ended=true;break;}}if(!ended)throw Error('varint');if(field===18){flags++;flag=pos-start===1&&low===0?'false':pos-start===1&&low===1?'true':'other';}}
        else if(wire===2){const length=uint();if(length>bytes.length-pos)throw Error('length');if(field===1){gids++;let got='';for(let n=0;n<length&&n<16;n++)got+=bytes[pos+n].toString(16).padStart(2,'0');matches=length===16&&got===hex;}pos+=length;}
        else if(wire===1||wire===5){pos+=wire===1?8:4;if(pos>bytes.length)throw Error('truncated');}else throw Error('wire');
      }
      event.inspection='protobuf';event.flag=flags>1?'other':flag;event.gidFormat=gids===1?'binary':'other';event.identityMatches=gids===1&&matches;return event;
    }
    event.inspection='unsupported';return event;
  }catch{event.inspection='invalid';event.candidateWouldPatch=false;return event;}
}
