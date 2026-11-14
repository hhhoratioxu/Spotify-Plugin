(function(){
const LIMIT=131072;let TEXT_UNITS;const nativeQX=false;
const LANGUAGES = ["zh-CN", "zh-TW", "en", "ja", "ko", "fr", "de", "es", "pt", "it", "ru", "ar", "hi", "id", "vi", "th", "tr", "nl", "pl", "sv", "uk", "he", "fa", "ms", "el"];
const SOURCES = { lrclib: "LRCLIB", qq: "QQ 音乐", netease: "网易云音乐", kugou: "酷狗音乐", kuwo: "酷我音乐", lyricsovh: "lyrics.ovh" };
const str = x => typeof x === "string" ? x : "";
const truth = x => x === true || x === "true";
function utf8Size(text, maxBytes = LIMIT) {
  let size = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = text.charCodeAt(++i); if (!(d >= 0xdc00 && d <= 0xdfff)) throw new URIError("invalid-utf16"); size += 4;
    } else if (c >= 0xdc00 && c <= 0xdfff) throw new URIError("invalid-utf16");
    else size += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
    if (size > maxBytes) { const error = new Error("body-limit"); error.bodyBytes = size; throw error; }
  }
  return size;
}
function putUTF8(out, at, text) {
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) c = 0x10000 + ((c - 0xd800) << 10) + text.charCodeAt(++i) - 0xdc00;
    if (c < 0x80) out[at++] = c;
    else if (c < 0x800) { out[at++] = 0xc0 | c >> 6; out[at++] = 0x80 | c & 63; }
    else if (c < 0x10000) { out[at++] = 0xe0 | c >> 12; out[at++] = 0x80 | c >> 6 & 63; out[at++] = 0x80 | c & 63; }
    else { out[at++] = 0xf0 | c >> 18; out[at++] = 0x80 | c >> 12 & 63; out[at++] = 0x80 | c >> 6 & 63; out[at++] = 0x80 | c & 63; }
  }
  return at;
}
function utf8(text, maxBytes = LIMIT) {
  const out = new Uint8Array(utf8Size(text,maxBytes));
  putUTF8(out,0,text); return out;
}
function text(bytes) {
  // No TextDecoder dependency in mobile engines. ASCII needs no intermediate
  // number array; all fromCharCode calls stay below the old argument ceiling.
  let ascii = true;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] >= 128) { ascii = false; break; }
  if (ascii && bytes.length <= 4096) return String.fromCharCode.apply(null,bytes);
  if (ascii) {
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 4096) chunks.push(String.fromCharCode.apply(null,bytes.subarray(i,i+4096)));
    return chunks.join("");
  }
  // Non-ASCII scratch is at most 8,194 bytes, not a growable array of JS
  // numbers. The extra unit keeps surrogate pairs together at a boundary.
  // Synchronous decoding returns copied strings, never this scratch view.
  // Reuse at most 8,194 bytes across the many short words in one execution.
  const capacity = Math.min(bytes.length,4097);
  if (!TEXT_UNITS || TEXT_UNITS.length < capacity) TEXT_UNITS = new Uint16Array(capacity);
  const units = TEXT_UNITS; let used = 0, chunks;
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++]; let cp, count, minimum;
    if (first < 0x80) { cp = first; count = 0; minimum = 0; }
    else if (first >= 0xc2 && first <= 0xdf) { cp = first & 31; count = 1; minimum = 0x80; }
    else if (first >= 0xe0 && first <= 0xef) { cp = first & 15; count = 2; minimum = 0x800; }
    else if (first >= 0xf0 && first <= 0xf4) { cp = first & 7; count = 3; minimum = 0x10000; }
    else throw new URIError("invalid-utf8");
    for (let j = 0; j < count; j++) { const b = bytes[i++]; if (!(b >= 0x80 && b <= 0xbf)) throw new URIError("invalid-utf8"); cp = cp * 64 + (b & 63); }
    if (cp < minimum || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw new URIError("invalid-utf8");
    if (cp < 0x10000) units[used++] = cp; else { cp -= 0x10000; units[used++] = 0xd800 | cp >> 10; units[used++] = 0xdc00 | cp & 1023; }
    if (used >= 4096) { (chunks || (chunks = [])).push(String.fromCharCode.apply(null, units.subarray(0,used))); used = 0; }
  }
  if (!chunks) return used ? String.fromCharCode.apply(null, units.subarray(0,used)) : "";
  if (used) chunks.push(String.fromCharCode.apply(null, units.subarray(0,used)));
  return chunks.join("");
}
function settings(env = {}) {
  const provider = str(env.FALLBACK_PROVIDER) || "auto";
  const language = str(env.TARGET_LANGUAGE) || "zh-CN";
  if (!LANGUAGES.includes(language) || !["auto", "off", ...Object.keys(SOURCES)].includes(provider)) throw new Error("settings-invalid");
  const preferred = Object.hasOwn(SOURCES,str(env.PREFERRED_SOURCE)) ? str(env.PREFERRED_SOURCE) : "auto";
  return { fetchArtwork: env.FETCH_ARTWORK_COLOR == null || env.FETCH_ARTWORK_COLOR === "" ? true : truth(env.FETCH_ARTWORK_COLOR), preferred, translate: env.TRANSLATION_ENABLED == null || env.TRANSLATION_ENABLED === "" ? true : truth(env.TRANSLATION_ENABLED), language, provider, discover: env.DISCOVER_MISSING == null || env.DISCOVER_MISSING === "" ? true : truth(env.DISCOVER_MISSING), sourceTranslations: env.SOURCE_TRANSLATIONS == null || env.SOURCE_TRANSLATIONS === "" ? true : truth(env.SOURCE_TRANSLATIONS) };
}
function nativeArguments() {
  const allowed = ["TRANSLATION_ENABLED", "TARGET_LANGUAGE", "FALLBACK_PROVIDER", "DISCOVER_MISSING", "SOURCE_TRANSLATIONS", "PREFERRED_SOURCE", "MEMORY_MODE", "FETCH_ARTWORK_COLOR", "FALLBACK_OFFSET_MS", "FALLBACK_MODE", "NETWORK_MODE", "REPLACE_UNSYNCED"];
  const env = Object.create(null);
  function add(raw) {
    if (typeof raw === "string") {
      for (const item of raw.split("&")) {
        const equal = item.indexOf("=");
        if (equal < 1) continue;
        const key = decodeURIComponent(item.slice(0, equal));
        if (allowed.includes(key)) env[key] = decodeURIComponent(item.slice(equal + 1));
      }
    } else if (raw && typeof raw === "object") {
      for (const key of allowed) if (raw[key] != null) env[key] = String(raw[key]);
    }
  }
  if (nativeQX && typeof $environment !== "undefined") {
    const source = String($environment.sourcePath || "");
    if (source.includes("#")) add(source.slice(source.indexOf("#") + 1));
    add($environment.variables);
  }
  if (typeof $argument !== "undefined") add($argument);
  return env;
}
function boundedJSON(input) {
  if(typeof input!=='string'||input.length>262144)throw Error('json-limit');
  let i=0,nodes=0;const members=Object.create(null);
  const white=()=>{while(i<input.length&&/[ \t\r\n]/.test(input[i]))i++;};
  const string=()=>{
    if(input[i]!=='"')throw Error('string');const start=i++;
    while(i<input.length){
      const c=input.charCodeAt(i++);if(c===34)return JSON.parse(input.slice(start,i));if(c<32)throw Error('control');
      if(c===92){const escaped=input[i++];if(escaped==='u'){if(!/^[0-9a-fA-F]{4}$/.test(input.slice(i,i+4)))throw Error('escape');i+=4;}else if(!'"\\/bfnrt'.includes(escaped||'\u0000'))throw Error('escape');}
    }throw Error('unterminated');
  };
  function value(depth){
    if(depth>32||++nodes>32768)throw Error('structure-limit');white();const start=i,c=input[i];
    if(c==='{'){
      i++;white();const keys=new Set();if(input[i]==='}'){i++;return;}
      while(true){white();const key=string();if(keys.has(key))throw Error('duplicate');keys.add(key);white();if(input[i++]!==':')throw Error('colon');white();const at=i;value(depth+1);if(depth===0)members[key]=[at,i];white();const separator=input[i++];if(separator==='}')return;if(separator!==',')throw Error('comma');}
    }
    if(c==='['){i++;white();if(input[i]===']'){i++;return;}while(true){value(depth+1);white();const separator=input[i++];if(separator===']')return;if(separator!==',')throw Error('comma');}}
    if(c==='"'){string();return;}
    for(const token of ['true','false','null'])if(input.startsWith(token,i)){i+=token.length;return;}
    while(i<input.length&&!/[ \t\r\n,\]}]/.test(input[i]))i++;
    if(!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(input.slice(start,i)))throw Error('number');
  }
  white();if(input[i]!=='{')throw Error('root');value(0);white();if(i!==input.length)throw Error('trailing');
  return {doc:JSON.parse(input),members};
}
function macJSONMetadata(request, response, env, codec) {
  try {
    const limit = 131072;
    if (!request || !response || request.method !== 'GET' || Number(response.status) !== 200 || typeof request.url !== 'string' || request.url.length > 4096) return null;
    const route = /^https:\/\/(?:spclient\.wg|[a-z0-9-]+-spclient)\.spotify\.com(?::443)?\/metadata\/4\/track\/([0-9a-f]{32})(?:\?[^#\s]*)?$/.exec(request.url);
    if (!route) return null;
    const get = (headers, name) => {
      const keys = Object.keys(headers || {}).filter(k => k.toLowerCase() === name);
      if (keys.length > 1) throw Error('ambiguous-header');
      return keys.length ? String(headers[keys[0]]) : '';
    };
    if (get(request.headers, 'x-verselyrics-internal')) return null;
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;[^\r\n]*)?$/i.test(get(response.headers, 'content-type'))) return null;
    const length = get(response.headers, 'content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > limit)) return null;
    const config = codec.settings(env);
    if (!config.discover || config.provider === 'off') return null;
    let input;
    if (typeof response.body === 'string') {
      if (response.body.length > limit) return null;
      input = response.body;
    } else {
      const body = response.body;
      if (!ArrayBuffer.isView(body) || body.byteLength > limit) return null;
      input = codec.text(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    }
    codec.utf8Size(input, limit);
    if (!input.startsWith('{') && !/^\s*\{/.test(input)) return null;

    const {doc,members}=codec.scanJSON(input),flag=members.has_lyrics;
    if(!flag||input.slice(...flag)!=='false')return null;
    if (!doc || Array.isArray(doc) || doc.has_lyrics !== false || Object.hasOwn(doc, 'hasLyrics')) return null;
    const label = s => {
      if(typeof s !== 'string' || s.length > 512 || !s.trim() || /[\u0000-\u001f]/.test(s))return false;
      codec.utf8Size(s,2048);return true;
    };
    if (!label(doc.name) || !label(doc.album?.name) || !Array.isArray(doc.artist) || !doc.artist.length || doc.artist.length > 16 || !doc.artist.every(a => a && !Array.isArray(a) && label(a.name))) return null;
    if (!Number.isInteger(doc.duration) || doc.duration <= 0 || doc.duration > 86400000) return null;
    // An unverified access/restriction representation is never interpreted.
    if (Object.hasOwn(doc, 'content_access_status') || Object.hasOwn(doc, 'contentAccessStatus') || Object.hasOwn(doc, 'restriction') && (!Array.isArray(doc.restriction) || doc.restriction.length)) return null;
    if (typeof doc.gid !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(doc.gid)) return null;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0, accumulator = 0, hex = '';
    for (const c of doc.gid.slice(0,22)) {
      accumulator = (accumulator << 6) | alphabet.indexOf(c); bits += 6;
      if (bits >= 8) { bits -= 8; hex += ((accumulator >> bits) & 255).toString(16).padStart(2,'0'); }
    }
    if (hex !== route[1] || (alphabet.indexOf(doc.gid[21]) & 15)) return null;
    const output = input.slice(0, flag[0]) + 'true' + input.slice(flag[1]);
    const headers = {...response.headers};
    for (const key of Object.keys(headers)) if (['content-length','content-encoding','etag','content-md5','digest','last-modified','cache-control','content-type','x-verselyrics'].includes(key.toLowerCase())) delete headers[key];
    headers['Content-Type'] = 'application/json; charset=utf-8'; headers['Cache-Control'] = 'no-store'; headers['x-verselyrics'] = '3.2.2';
    return {headers, body:typeof response.body === 'string' ? output : codec.utf8(output, limit)};
  } catch { return null; }
}
function metadataObservation(request,response,readBody,codec){
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
try{const event=metadataObservation(typeof $request==="undefined"?null:$request,typeof $response==="undefined"?null:$response,false,{settings,utf8Size,utf8,text,scanJSON:boundedJSON,candidate:macJSONMetadata});if(event){const line="SpotifyLyricsMeta "+JSON.stringify(event);if(line.length<=2048)console.log(line);}}catch{}
$done({});
})();
