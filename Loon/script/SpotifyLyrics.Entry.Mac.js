(function(hostDone){
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
function macMetadataEntry(request, response, env, codec) {
  try {
    const limit = 131072;
    if (request?.method !== 'GET' || Number(response?.status) !== 200 || typeof request.url !== 'string' || request.url.length > 4096) return null;
    const match = /^https:\/\/(?:spclient\.wg|[a-z0-9-]+-spclient)\.spotify\.com(?::443)?\/metadata\/4\/track\/([0-9a-f]{32})(?:\?[^#\s]*)?$/.exec(request.url);
    if (!match) return null;
    const get = (headers, name) => {
      const keys = Object.keys(headers || {}).filter(key => key.toLowerCase() === name);
      if (keys.length > 1) throw Error('ambiguous-header');
      return keys.length ? String(headers[keys[0]]) : '';
    };
    if (get(request.headers, 'x-verselyrics-internal')) return null;
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;[^\r\n]*)?$/i.test(get(response.headers, 'content-type'))) return null;
    const length = get(response.headers, 'content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > limit)) return null;
    const config = codec.settings(env);
    if (!config.discover || config.provider === 'off') return null;
    const body = response.body;
    if (typeof body !== 'string' && (!ArrayBuffer.isView(body) || body.byteLength > limit)) return null;
    if (typeof body === 'string' && body.length > limit) return null;
    const input = typeof body === 'string' ? body : codec.text(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    codec.utf8Size(input, limit);
    const {doc, members} = codec.scanJSON(input);
    if (Object.hasOwn(doc, 'hasLyrics')) return null;
    const flag = members.has_lyrics;
    if (flag && (doc.has_lyrics !== false || input.slice(...flag) !== 'false')) return null;
    const label = value => {
      if (typeof value !== 'string' || !value.trim() || value.length > 512 || /[\u0000-\u001f]/.test(value)) return false;
      codec.utf8Size(value, 2048); return true;
    };
    if (!label(doc.name) || !label(doc.album?.name) || !Array.isArray(doc.artist) || !doc.artist.length || doc.artist.length > 16 || !doc.artist.every(artist => artist && !Array.isArray(artist) && label(artist.name))) return null;
    if (!Number.isInteger(doc.duration) || doc.duration <= 0 || doc.duration > 86400000) return null;
    if (Object.hasOwn(doc, 'content_access_status') || Object.hasOwn(doc, 'contentAccessStatus') || Object.hasOwn(doc, 'restriction') && (!Array.isArray(doc.restriction) || doc.restriction.length)) return null;
    // Hex plus an omitted false value is the actual Desktop shape observed on
    // 2026-11-16. The older, explicit-false base64 shape remains supported.
    let hex;
    if (typeof doc.gid === 'string' && /^[0-9a-f]{32}$/.test(doc.gid)) hex = doc.gid;
    else {
      if (!flag || typeof doc.gid !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(doc.gid)) return null;
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      if (alphabet.indexOf(doc.gid[21]) & 15) return null;
      let bits = 0, accumulator = 0; hex = '';
      for (const char of doc.gid.slice(0, 22)) {
        accumulator = (accumulator << 6) | alphabet.indexOf(char); bits += 6;
        if (bits >= 8) { bits -= 8; hex += ((accumulator >> bits) & 255).toString(16).padStart(2, '0'); }
      }
    }
    if (hex !== match[1]) return null;
    let output;
    if (flag) output = input.slice(0, flag[0]) + 'true' + input.slice(flag[1]);
    else {
      const end = input.search(/\}\s*$/);
      if (end < 0) return null;
      output = input.slice(0, end) + ',"has_lyrics":true' + input.slice(end);
    }
    const encoded = typeof body === 'string' ? (codec.utf8Size(output, limit), output) : codec.utf8(output, limit);
    const headers = {...response.headers};
    for (const key of Object.keys(headers)) if (['content-length', 'content-encoding', 'etag', 'content-md5', 'digest', 'last-modified', 'cache-control', 'content-type', 'x-verselyrics'].includes(key.toLowerCase())) delete headers[key];
    headers['Content-Type'] = 'application/json; charset=utf-8';
    headers['Cache-Control'] = 'no-store'; headers['x-verselyrics'] = '3.2.2';
    // The native adapter can reuse this already validated catalog identity.
    // A cache failure must never prevent returning the compatible response.
    try { codec.remember?.({gid:hex,title:doc.name,album:doc.album.name,artists:doc.artist.map(artist => artist.name),duration:doc.duration / 1000}); } catch {}
    return {headers, body:encoded};
  } catch { return null; }
}
const KEY = "VerseLyrics.v1.cache";
const CACHE_LIMIT = 64000;
const CACHE_COUNT = 128;
const MAX_LINES = 600;
const B62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const goodObject = x => x !== null && typeof x === "object" && !Array.isArray(x);
function hexBase62(hex) {
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("track-hex");
  const a = hex.match(/../g).map(x => parseInt(x, 16)); let out = "";
  while (a.some(Boolean)) {
    let carry = 0;
    for (let i = 0; i < a.length; i++) { const n = carry * 256 + a[i]; a[i] = Math.floor(n / 62); carry = n % 62; }
    out = B62[carry] + out;
  }
  return out.padStart(22, "0");
}
function translationPair(pair) {
  return Array.isArray(pair) && (pair.length === 2 || pair.length === 3 && (pair[2] === "source" || pair[2] === "checked" || pair[1] === "" && Number.isFinite(pair[2]) && pair[2] > 0)) && typeof pair[0] === "string" && typeof pair[1] === "string";
}
function indexedCache(raw, relevant, rememberSize) {
  if (!raw.startsWith('{"sizes":[')) return null;
  try {
    const middle = '],"entries":[', split = raw.indexOf(middle);
    if (split < 9 || split > 1024) return null;
    const sizes = JSON.parse(raw.slice(9,split+1));
    if (!Array.isArray(sizes) || sizes.length > CACHE_COUNT) return null;
    const entries = [], keyPattern = /\{"key":(?:"([^"\\\x00-\x1f]*)"|("(?:[^"\\]|\\.)*")),"value":/y;
    let at = split + middle.length;
    for (let i = 0; i < sizes.length; i++) {
      const n = sizes[i], end = at + n;
      if (!Number.isInteger(n) || n < 1 || n > CACHE_LIMIT / 2 || end >= raw.length || raw[end] !== (i+1 === sizes.length ? ']' : ',')) return null;
      keyPattern.lastIndex = at;
      const match = keyPattern.exec(raw);
      if (!match || match[0].length > Math.min(n,4096)) return null;
      // Plain JSON string contents are already validated by the first branch.
      // Escaped legacy keys still use JSON.parse; never decode an opaque value.
      const key = match[1] === undefined ? JSON.parse(match[2]) : match[1];
      if (relevant(key)) {
        const e = JSON.parse(raw.slice(at,end));
        if (e.key !== key) return null;
        entries.push(e); rememberSize(e,n);
      }
      at = end + (i+1 < sizes.length ? 1 : 0);
    }
    const tail = '],"cooldowns":';
    if (!raw.startsWith(tail,at) || raw.at(-1) !== '}') return null;
    return {entries,cooldowns:JSON.parse(raw.slice(at+tail.length,-1))};
  } catch { return null; }
}
function serializedCache(raw, rememberSize) {
  if (!raw.startsWith('{"sizes":[')) return null;
  try {
    const middle = '],"entries":[', split = raw.indexOf(middle);
    if (split < 9 || split > 1024) return null;
    const sizes = JSON.parse(raw.slice(9,split+1));
    if (!Array.isArray(sizes) || sizes.length > CACHE_COUNT) return null;
    const entries = []; let at = split + middle.length;
    for (let i = 0; i < sizes.length; i++) {
      const n = sizes[i], end = at + n;
      if (!Number.isInteger(n) || n < 1 || n > CACHE_LIMIT / 2 || end >= raw.length || raw[end] !== (i+1 === sizes.length ? ']' : ',')) return null;
      const saved = raw.slice(at,end), e = JSON.parse(saved);
      if (!goodObject(e) || typeof e.key !== "string" || !Object.hasOwn(e,"value") || !Object.hasOwn(e,"expires") || Object.keys(e).length !== 3 || !saved.startsWith('{"key":')) return null;
      // Validate one record, then retain its serialized text instead of rows.
      const kept = {key:e.key,expires:e.expires,saved};
      entries.push(kept); rememberSize(kept,n);
      at = end + (i+1 < sizes.length ? 1 : 0);
    }
    const tail = '],"cooldowns":';
    if (!raw.startsWith(tail,at) || raw.at(-1) !== '}') return null;
    return {entries,cooldowns:JSON.parse(raw.slice(at+tail.length,-1)),ranges:true};
  } catch { return null; }
}
function loadCache(ctx, scope) {
  const small = ctx.env?.MEMORY_MODE === "compact", charCap = small ? 32000 : CACHE_LIMIT, entryCap = small ? 64 : CACHE_COUNT;
  let loaded = false, entries = [], cooldowns = {}, initialCooldowns = "{}", compact = false, ranges = false;
  let pending, costs, total = 0;
  const indexed = typeof ctx.storage.get === "function" && typeof ctx.storage.set === "function";
  let trackSuffix, linePrefix, translationSet;
  // Keep other songs out of the live heap while a native HTTP call is pending.
  // Saving still merges against the complete bounded store, never this view alone.
  function relevant(e) { return relevantKey(str(e?.key)); }
  function relevantKey(key) {
    if (!scope) return true;
    if (scope.metadata) return key.startsWith("meta:") || key.startsWith("availability:");
    // Scope flags can change before or after the first read. The track and
    // language do not; build their key fragments only when this view needs them.
    if (linePrefix === undefined) {
      trackSuffix = ":" + scope.track;
      linePrefix = "translation:" + scope.language + ":";
      translationSet = "translations:v1:" + scope.language + trackSuffix;
    }
    if (scope.translations) return key === translationSet || key.startsWith(linePrefix);
    if (scope.translate === false && /^(?:translations:v1:|translation:)/.test(key)) return false;
    return key.endsWith(trackSuffix) || key.startsWith("source-order:v1:") || key.startsWith(linePrefix);
  }
  function overhead() { return JSON.stringify(indexed ? {sizes:[],entries:[],cooldowns} : {entries:[],cooldowns}).length; }
  function mergeCooldowns(value) {
    if (!goodObject(value)) return;
    for (const host of Object.keys(value)) {
      if (host.length > 253 || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host)) continue;
      const until = value[host];
      if (!Number.isFinite(until) || until <= Date.now()) continue;
      if (!Object.hasOwn(cooldowns, host) && Object.keys(cooldowns).length >= 16) continue;
      cooldowns[host] = Math.max(cooldowns[host] || 0, Math.min(until, Date.now() + 86400000));
    }
  }
  function cost(e) {
    if (!costs.has(e)) { const n = JSON.stringify(e).length; costs.set(e, n + 1 + (indexed ? String(n).length + 1 : 0)); }
    return costs.get(e);
  }
  function read(scoped = false, ranges = false) {
    let value;
    try {
      if (typeof ctx.storage.get === "function") {
        const raw = ctx.storage.get(KEY);
        if (typeof raw === "string" && raw.length <= 128000) {
          if (ranges && raw.length >= 4096) value = serializedCache(raw,(e,n) => costs.set(e,n + 1 + String(n).length + 1));
          else if (scoped && scope) value = indexedCache(raw,relevantKey,(e,n) => costs.set(e,n + 1 + (indexed ? String(n).length + 1 : 0)));
          if (!value) value = JSON.parse(raw);
        }
      }
      else value = ctx.storage.getJSON(KEY);
    } catch { }
    return goodObject(value) ? value : {};
  }
  function combineTranslations(a,b) {
    if (!a || !b.key.startsWith("translations:v1:") || !Array.isArray(a.value?.pairs) || !Array.isArray(b.value?.pairs)) return null;
    const newest = a.expires > b.expires ? a : b, older = newest === a ? b : a;
    const pairs = [], seen = new Set(); let size = JSON.stringify({...newest,value:{pairs:[]}}).length;
    for (const record of [newest,older]) for (const pair of record.value.pairs.slice(0,MAX_LINES)) {
      if (!translationPair(pair) || seen.has(pair[0])) continue;
      const length = JSON.stringify(pair).length + 1;
      if (pairs.length >= MAX_LINES || size + length > charCap / 2) continue;
      size += length; pairs.push(pair); seen.add(pair[0]);
    }
    return {...newest,value:{pairs}};
  }
  function materialize(e, ranges) {
    if (!ranges || !e || Object.hasOwn(e,"value")) return e;
    const value = JSON.parse(e.saved);
    costs.set(value,cost(e)); return value;
  }
  function bounded(input) {
    const kept = [], seen = new Set(); let size = overhead();
    for (let i = input.length - 1; i >= 0 && kept.length < entryCap; i--) {
      const e = input[i];
      if (!goodObject(e) || typeof e.key !== "string" || !Number.isFinite(e.expires) || e.expires <= Date.now() || seen.has(e.key)) continue;
      let length; try { length = cost(e); } catch { continue; }
      if (length > charCap / 2 || size + length > charCap) continue;
      size += length; seen.add(e.key); kept.push(e);
    }
    return kept.reverse();
  }
  function ensure() {
    if (loaded) return; loaded = true;
    pending = new Map(); costs = new WeakMap();
    const data = read(true), original = Array.isArray(data.entries) ? data.entries : [];
    mergeCooldowns(data.cooldowns);
    entries = bounded(scope ? original.filter(relevant) : original);
    total = entries.reduce((n,e) => n + cost(e), 0);
    compact = !scope && entries.length !== original.length;
    initialCooldowns = JSON.stringify(cooldowns);
  }
  return {
    get entries() { ensure(); if (ranges) { entries = entries.map(e => materialize(e,true)); ranges = false; } return entries; },
    get cooldowns() { ensure(); return cooldowns; },
    get(key) { ensure(); for (let i = entries.length - 1; i >= 0; i--) if (entries[i].key === key && entries[i].expires > Date.now()) { if (ranges) entries[i] = materialize(entries[i],true); return entries[i].value; } },
    put(key, value, ttl = 86400000, expires = Date.now() + ttl) {
      ensure(); const entry = { key, value, expires };
      let length; try { length = cost(entry); } catch { return; }
      if (length > charCap / 2) return;
      const old = entries.findIndex(e => e.key === key);
      if (old >= 0) { total -= cost(entries[old]); entries.splice(old, 1); }
      entries.push(entry); pending.set(key, entry); total += length;
      // Track entry costs incrementally; include changing cooldown metadata
      // without walking the entire retained cache after every metadata row.
      const reserved = overhead();
      while (entries.length > entryCap || total + reserved > charCap) { const e = entries.shift(); total -= cost(e); pending.delete(e.key); }
    },
    save() {
      // Card-only and unchanged responses never load or rewrite the lyric cache.
      if (!loaded || (!compact && !pending.size && initialCooldowns === JSON.stringify(cooldowns))) return;
      try {
        const latest = read(false,indexed);
        const merged = new Map();
        for (const e of bounded(Array.isArray(latest.entries) ? latest.entries : [])) merged.set(e.key, e);
        for (const e of pending.values()) {
          if (!goodObject(e) || typeof e.key !== "string" || !Number.isFinite(e.expires) || e.expires <= Date.now()) continue;
          const combined = e.key.startsWith("translations:v1:") ? combineTranslations(materialize(merged.get(e.key),latest.ranges),e) : null;
          if (combined || !merged.has(e.key) || merged.get(e.key).expires <= e.expires) { merged.delete(e.key); merged.set(e.key, combined || e); }
        }
        // Include cooldown metadata in the same serialized storage limit.
        for (const host of Object.keys(cooldowns)) if (cooldowns[host] <= Date.now()) delete cooldowns[host];
        mergeCooldowns(latest.cooldowns);
        const complete = bounded([...merged.values()]);
        if (indexed) {
          const parts = complete.map(e => latest.ranges && !Object.hasOwn(e,"value") ? e.saved : JSON.stringify({key:e.key,value:e.value,expires:e.expires}));
          const raw = '{"sizes":' + JSON.stringify(parts.map(s => s.length)) + ',"entries":[' + parts.join(',') + '],"cooldowns":' + JSON.stringify(cooldowns) + '}';
          if (raw.length > charCap) return;
          ctx.storage.set(KEY,raw);
        } else ctx.storage.setJSON(KEY, { entries: complete, cooldowns });
        entries = scope ? complete.filter(relevant) : complete;
        // Script completion usually follows save immediately. Keep untouched
        // ranges serialized; a later get/entries read materializes on demand.
        ranges = latest.ranges === true;
        total = entries.reduce((n,e) => n + cost(e), 0);
        pending.clear(); compact = false; initialCooldowns = JSON.stringify(cooldowns);
      } catch { }
    }
  };
}
function cacheMetadata(state, parsed) {
  const key = "meta:" + parsed.meta.id, old = state.cache.get(key), next = parsed.meta;
  const same = old && old.id === next.id && old.title === next.title && old.album === next.album && old.duration === next.duration &&
    Array.isArray(old.artists) && old.artists.length === next.artists.length && old.artists.every((name,i) => name === next.artists[i]);
  if (!same) state.cache.put(key,next);
  const available = "availability:" + next.id;
  if (parsed.hasLyrics !== null && state.cache.get(available) !== parsed.hasLyrics) state.cache.put(available,parsed.hasLyrics,300000);
}
function macRememberMetadata(record) {
  const storage={get:key=>$persistentStore.read(key),set:(key,value)=>$persistentStore.write(value,key)};
  const cache=loadCache({env:nativeArguments(),storage},{metadata:true});
  cacheMetadata({cache},{meta:{id:hexBase62(record.gid),title:record.title,album:record.album,artists:record.artists,duration:record.duration},hasLyrics:false});
  cache.save();
}

let patched;try{patched=macMetadataEntry($request,$response,nativeArguments(),{settings,utf8Size,utf8,text,scanJSON:boundedJSON,remember:macRememberMetadata});}catch{}
if(patched){hostDone(patched);return;}
const $done=hostDone;
/* VerseLyrics Loon lightweight entry 3.2.2. */
(()=>{"use strict";function e(e,t){if(Number(v(e.headers,"Content-Length"))>t)throw new Error("body-limit");return e.boundedBytes(t)}
/* VerseLyrics 3.2.2 — original core, 2026-11-01.
 * Rewrites Spotify color-lyrics JSON and protobuf; no third-party script runtime.
 * Public protocol field numbers and service endpoints are documented in README.md.
 * Egern API: export default async function(ctx), ctx.http, ctx.storage.
 */const t="VerseLyrics.v1.cache",r=524288,n=262144,o=131072,s="x-verselyrics-internal",i="x-verselyrics",a="spotify:section:0JQ5DB6s3cssW5Bo6cGq21",c="(?:spclient\\.wg|[a-z0-9-]+-spclient)\\.spotify\\.com",l=new RegExp("^https://("+c+")(?::443)?/color-lyrics/v2/track/([0-9A-Za-z]{22})(?:/image/[^?#\\s]+)?/?(?:\\?.*)?$"),u=new RegExp("^https://("+c+")(?::443)?/metadata/4/track/([0-9a-f]{32})(?:\\?.*)?$"),f=new RegExp("^https://("+c+")(?::443)?/extended-metadata/v0/extended-metadata/?(?:\\?.*)?$"),h=new RegExp("^https://("+c+")(?::443)?/scrollsita/v1/scroll/spotify(?::|%3[aA])track(?::|%3[aA])([0-9A-Za-z]{22})/?(?:\\?.*)?$"),d=["zh-CN","zh-TW","en","ja","ko","fr","de","es","pt","it","ru","ar","hi","id","vi","th","tr","nl","pl","sv","uk","he","fa","ms","el"],p={lrclib:"LRCLIB",qq:"QQ 音乐",netease:"网易云音乐",kugou:"酷狗音乐",kuwo:"酷我音乐",lyricsovh:"lyrics.ovh"},y="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",g=e=>null!==e&&"object"==typeof e&&!Array.isArray(e),w=e=>"string"==typeof e?e:"",b=e=>!0===e||"true"===e,m=e=>w(e).replace(/\u0000/g,"").trim();function v(e,t){if("function"==typeof e?.get)return e.get(t)||"";const r=Object.keys(e||{}).find(e=>e.toLowerCase()===t.toLowerCase());return r?w(e[r]):""}function A(e,t=r){const n=new Uint8Array(function(e,t=r){let n=0;for(let r=0;r<e.length;r++){const o=e.charCodeAt(r);if(o>=55296&&o<=56319){const t=e.charCodeAt(++r);if(!(t>=56320&&t<=57343))throw new URIError("invalid-utf16");n+=4}else{if(o>=56320&&o<=57343)throw new URIError("invalid-utf16");n+=o<128?1:o<2048?2:3}if(n>t){const e=new Error("body-limit");throw e.bodyBytes=n,e}}return n}(e,t));return function(e,t,r){for(let n=0;n<r.length;n++){let o=r.charCodeAt(n);o>=55296&&o<=56319&&(o=65536+(o-55296<<10)+r.charCodeAt(++n)-56320),o<128?e[t++]=o:o<2048?(e[t++]=192|o>>6,e[t++]=128|63&o):o<65536?(e[t++]=224|o>>12,e[t++]=128|o>>6&63,e[t++]=128|63&o):(e[t++]=240|o>>18,e[t++]=128|o>>12&63,e[t++]=128|o>>6&63,e[t++]=128|63&o)}}(n,0,e),n}let E;function C(e){let t=!0;for(let r=0;r<e.length;r++)if(e[r]>=128){t=!1;break}if(t&&e.length<=4096)return String.fromCharCode.apply(null,e);if(t){const t=[];for(let r=0;r<e.length;r+=4096)t.push(String.fromCharCode.apply(null,e.subarray(r,r+4096)));return t.join("")}const r=Math.min(e.length,4097);(!E||E.length<r)&&(E=new Uint16Array(r));const n=E;let o,s=0;for(let t=0;t<e.length;){const r=e[t++];let i,a,c;if(r<128)i=r,a=0,c=0;else if(r>=194&&r<=223)i=31&r,a=1,c=128;else if(r>=224&&r<=239)i=15&r,a=2,c=2048;else{if(!(r>=240&&r<=244))throw new URIError("invalid-utf8");i=7&r,a=3,c=65536}for(let r=0;r<a;r++){const r=e[t++];if(!(r>=128&&r<=191))throw new URIError("invalid-utf8");i=64*i+(63&r)}if(i<c||i>1114111||i>=55296&&i<=57343)throw new URIError("invalid-utf8");i<65536?n[s++]=i:(i-=65536,n[s++]=55296|i>>10,n[s++]=56320|1023&i),s>=4096&&((o||(o=[])).push(String.fromCharCode.apply(null,n.subarray(0,s))),s=0)}return o?(s&&o.push(String.fromCharCode.apply(null,n.subarray(0,s))),o.join("")):s?String.fromCharCode.apply(null,n.subarray(0,s)):""}function O(e){const t=e.reduce((e,t)=>e+t.length,0);if(t>r)throw new Error("body-limit");const n=new Uint8Array(t);let o=0;for(const t of e)n.set(t,o),o+=t.length;return n}function S(e){if(!Number.isSafeInteger(e)||e<0)throw new Error("integer");const t=[];do{const r=e%128;e=Math.floor(e/128),t.push(r+(e?128:0))}while(e);return Uint8Array.from(t)}function k(e){if(e>=0)return S(e);let t=e>>>0;const r=[];for(let e=0;e<4;e++)r.push(t%128|128),t=Math.floor(t/128);return r.push(240|t,255,255,255,255,1),Uint8Array.from(r)}function N(e,t){let r=0,n=1,o=!0;for(let s=0;s<10;s++){if(t>=e.length)throw new Error("truncated-varint");const i=e[t++];if(9===s&&i>1)throw new Error("overflow-varint");if(r+=(127&i)*n,o=o&&Number.isSafeInteger(r),!(128&i))return{at:t,n:o?r:null};n*=128}throw new Error("long-varint")}function j(e,t){let n=0,o=0;for(;n<e.length;){if(o++>=4096)throw new Error("field-limit");const s=n;let i=e[n++];if(!(i<128)){const t=N(e,s);i=t.n,n=t.at}if(!i||i>4294967295)throw new Error("bad-tag");const a=Math.floor(i/8),c=i%8;if(a<1)throw new Error("bad-field-number");let l,u,f;if(0===c)if(e[n]<128)f=e[n++];else{const t=N(e,n);f=t.n,n=t.at}else if(1===c||5===c)n+=1===c?8:4;else{if(2!==c)throw new Error("unsupported-wire");{let t=e[n++];if(!(t<128)){const r=N(e,n-1);t=r.n,n=r.at}if(null===t||t>r)throw new Error("bad-length");l=n,n+=t,u=n}}if(n>e.length)throw new Error("truncated-field");t(a,c,l,u,f,s,n)}}function L(e){const t=[];return j(e,(r,n,o,s,i,a,c)=>{t.push({number:r,wire:n,payload:2===n?e.subarray(o,s):void 0,value:i,raw:e.subarray(a,c)})}),t}function x(e,t){return O([S(8*e+2),S(t.length),t])}function I(e,t){return x(e,A(t))}function M(e,t){return O([S(8*e),k(t)])}function $(e,t,r){for(let n=e.length-1;n>=0;n--)if(e[n].number===t&&e[n].wire===r)return e[n]}function R(e,t){const r=$(e,t,2);return r?C(r.payload):""}function J(e,t,r){let n=!1;const o=[];for(const s of e)s.number===t?(!n&&r&&o.push(r),n=!0):o.push(s.raw);return!n&&r&&o.push(r),O(o)}function T(e){if(!/^[0-9A-Za-z]{22}$/.test(e))throw new Error("track-id");const t=new Array(16).fill(0);for(const r of e){let e=y.indexOf(r);for(let r=15;r>=0;r--){const n=62*t[r]+e;t[r]=n%256,e=Math.floor(n/256)}if(e)throw new Error("track-overflow")}return t.map(e=>e.toString(16).padStart(2,"0")).join("")}function z(e){if(!/^[0-9a-f]{32}$/.test(e))throw new Error("track-hex");const t=e.match(/../g).map(e=>parseInt(e,16));let r="";for(;t.some(Boolean);){let e=0;for(let r=0;r<t.length;r++){const n=256*e+t[r];t[r]=Math.floor(n/62),e=n%62}r=y[e]+r}return r.padStart(22,"0")}function _(e,t,r=!1){let n,o,s,i="",a="",c=!1;const l=[];function u(t,r){let n="";return j(e.subarray(t,r),(r,o,s,i)=>{2===r&&2===o&&(n=C(e.subarray(t+s,t+i)))}),n}if(j(e,(t,r,f,h,d)=>{1===t&&2===r?n=e.subarray(f,h):2===t&&2===r?i=C(e.subarray(f,h)):3===t&&2===r?a=u(f,h):4===t&&2===r?l.push(u(f,h)):7===t&&0===r?o=d:18===t&&(0!==r?c=!0:s=d)}),!n||16!==n.length||n.some((e,r)=>e!==parseInt(t.slice(2*r,2*r+2),16)))throw new Error("metadata-id");const f={id:z(t),title:i,album:a,artists:l,duration:Number.isSafeInteger(o)?(o%2?-(o+1)/2:o/2)/1e3:0};if(!m(f.title)||!m(f.album)||!f.artists.length||f.artists.some(e=>!m(e))||f.duration<=0||f.duration>86400)throw new Error("metadata-incomplete");if(c||void 0!==s&&0!==s&&1!==s)throw new Error("metadata-lyrics-flag");return r?{meta:f,hasLyrics:1===s,hasLyricsField:void 0!==s}:{meta:f,get fs(){return L(e)},hasLyrics:1===s,hasLyricsField:void 0!==s}}function q(e={}){const t=w(e.FALLBACK_PROVIDER)||"auto",r=w(e.TARGET_LANGUAGE)||"zh-CN";if(!d.includes(r)||!["auto","off",...Object.keys(p)].includes(t))throw new Error("settings-invalid");return{translate:null==e.TRANSLATION_ENABLED||""===e.TRANSLATION_ENABLED||b(e.TRANSLATION_ENABLED),language:r,provider:t,discover:null==e.DISCOVER_MISSING||""===e.DISCOVER_MISSING||b(e.DISCOVER_MISSING)}}function D(e,r){const n="compact"===e.env?.MEMORY_MODE,o=n?32e3:64e3,s=n?64:128;let i,a,c=!1,l=[],u={},f="{}",h=!1,d=!1,p=0;const y="function"==typeof e.storage.get&&"function"==typeof e.storage.set;function b(e){return m(w(e?.key))}function m(e){return e.startsWith("meta:")||e.startsWith("availability:")}function v(){return JSON.stringify(y?{sizes:[],entries:[],cooldowns:u}:{entries:[],cooldowns:u}).length}function A(e){if(g(e))for(const t of Object.keys(e)){if(t.length>253||!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(t))continue;const r=e[t];!Number.isFinite(r)||r<=Date.now()||!Object.hasOwn(u,t)&&Object.keys(u).length>=16||(u[t]=Math.max(u[t]||0,Math.min(r,Date.now()+864e5)))}}function E(e){if(!a.has(e)){const t=JSON.stringify(e).length;a.set(e,t+1+(y?String(t).length+1:0))}return a.get(e)}function C(n=!1,o=!1){let s;try{if("function"==typeof e.storage.get){const i=e.storage.get(t);"string"==typeof i&&i.length<=128e3&&(o&&i.length>=4096?s=function(e,t){if(!e.startsWith('{"sizes":['))return null;try{const r='],"entries":[',n=e.indexOf(r);if(n<9||n>1024)return null;const o=JSON.parse(e.slice(9,n+1));if(!Array.isArray(o)||o.length>128)return null;const s=[];let i=n+r.length;for(let r=0;r<o.length;r++){const n=o[r],a=i+n;if(!Number.isInteger(n)||n<1||n>32e3||a>=e.length||e[a]!==(r+1===o.length?"]":","))return null;const c=e.slice(i,a),l=JSON.parse(c);if(!(g(l)&&"string"==typeof l.key&&Object.hasOwn(l,"value")&&Object.hasOwn(l,"expires")&&3===Object.keys(l).length&&c.startsWith('{"key":')))return null;const u={key:l.key,expires:l.expires,saved:c};s.push(u),t(u,n),i=a+(r+1<o.length?1:0)}const a='],"cooldowns":';return e.startsWith(a,i)&&"}"===e.at(-1)?{entries:s,cooldowns:JSON.parse(e.slice(i+a.length,-1)),ranges:!0}:null}catch{return null}}(i,(e,t)=>a.set(e,t+1+String(t).length+1)):n&&r&&(s=function(e,t,r){if(!e.startsWith('{"sizes":['))return null;try{const n='],"entries":[',o=e.indexOf(n);if(o<9||o>1024)return null;const s=JSON.parse(e.slice(9,o+1));if(!Array.isArray(s)||s.length>128)return null;const i=[],a=/\{"key":(?:"([^"\\\x00-\x1f]*)"|("(?:[^"\\]|\\.)*")),"value":/y;let c=o+n.length;for(let n=0;n<s.length;n++){const o=s[n],l=c+o;if(!Number.isInteger(o)||o<1||o>32e3||l>=e.length||e[l]!==(n+1===s.length?"]":","))return null;a.lastIndex=c;const u=a.exec(e);if(!u||u[0].length>Math.min(o,4096))return null;const f=void 0===u[1]?JSON.parse(u[2]):u[1];if(t(f)){const t=JSON.parse(e.slice(c,l));if(t.key!==f)return null;i.push(t),r(t,o)}c=l+(n+1<s.length?1:0)}const l='],"cooldowns":';return e.startsWith(l,c)&&"}"===e.at(-1)?{entries:i,cooldowns:JSON.parse(e.slice(c+l.length,-1))}:null}catch{return null}}(i,m,(e,t)=>a.set(e,t+1+(y?String(t).length+1:0)))),s||(s=JSON.parse(i)))}else s=e.storage.getJSON(t)}catch{}return g(s)?s:{}}function O(e,t){if(!t||!e||Object.hasOwn(e,"value"))return e;const r=JSON.parse(e.saved);return a.set(r,E(e)),r}function S(e){const t=[],r=new Set;let n=v();for(let i=e.length-1;i>=0&&t.length<s;i--){const s=e[i];if(!g(s)||"string"!=typeof s.key||!Number.isFinite(s.expires)||s.expires<=Date.now()||r.has(s.key))continue;let a;try{a=E(s)}catch{continue}a>o/2||n+a>o||(n+=a,r.add(s.key),t.push(s))}return t.reverse()}function k(){if(c)return;c=!0,i=new Map,a=new WeakMap;const e=C(!0),t=Array.isArray(e.entries)?e.entries:[];A(e.cooldowns),l=S(r?t.filter(b):t),p=l.reduce((e,t)=>e+E(t),0),h=!r&&l.length!==t.length,f=JSON.stringify(u)}return{get entries(){return k(),d&&(l=l.map(e=>O(e,!0)),d=!1),l},get cooldowns(){return k(),u},get(e){k();for(let t=l.length-1;t>=0;t--)if(l[t].key===e&&l[t].expires>Date.now())return d&&(l[t]=O(l[t],!0)),l[t].value},put(e,t,r=864e5,n=Date.now()+r){k();const a={key:e,value:t,expires:n};let c;try{c=E(a)}catch{return}if(c>o/2)return;const u=l.findIndex(t=>t.key===e);u>=0&&(p-=E(l[u]),l.splice(u,1)),l.push(a),i.set(e,a),p+=c;const f=v();for(;l.length>s||p+f>o;){const e=l.shift();p-=E(e),i.delete(e.key)}},save(){if(c&&(h||i.size||f!==JSON.stringify(u)))try{const n=C(!1,y),s=new Map;for(const e of S(Array.isArray(n.entries)?n.entries:[]))s.set(e.key,e);for(const e of i.values()){if(!g(e)||"string"!=typeof e.key||!Number.isFinite(e.expires)||e.expires<=Date.now())continue;const t=null;(t||!s.has(e.key)||s.get(e.key).expires<=e.expires)&&(s.delete(e.key),s.set(e.key,t||e))}for(const e of Object.keys(u))u[e]<=Date.now()&&delete u[e];A(n.cooldowns);const a=S([...s.values()]);if(y){const r=a.map(e=>n.ranges&&!Object.hasOwn(e,"value")?e.saved:JSON.stringify({key:e.key,value:e.value,expires:e.expires})),s='{"sizes":'+JSON.stringify(r.map(e=>e.length))+',"entries":['+r.join(",")+'],"cooldowns":'+JSON.stringify(u)+"}";if(s.length>o)return;e.storage.set(t,s)}else e.storage.setJSON(t,{entries:a,cooldowns:u});l=r?a.filter(b):a,d=!0===n.ranges,p=l.reduce((e,t)=>e+E(t),0),i.clear(),h=!1,f=JSON.stringify(u)}catch{}}}}function B(e,t){const r="meta:"+t.meta.id,n=e.cache.get(r),o=t.meta;n&&n.id===o.id&&n.title===o.title&&n.album===o.album&&n.duration===o.duration&&Array.isArray(n.artists)&&n.artists.length===o.artists.length&&n.artists.every((e,t)=>e===o.artists[t])||e.cache.put(r,o);const s="availability:"+o.id;null!==t.hasLyrics&&e.cache.get(s)!==t.hasLyrics&&e.cache.put(s,t.hasLyrics,3e5)}function U(e,t){const r=e.response.headers,n=v(r,"Content-Type"),o=v(e.request?.headers,"Accept").split(",").map(e=>e.trim()).find(e=>/^application\/[a-z0-9.+-]*protobuf$/i.test(e));for(const e of["Content-Length","Content-Encoding","ETag","Content-MD5","Digest","Last-Modified","Cache-Control","Content-Type",i])r.delete(e);return r.set("Content-Type","json"===t?"application/json; charset=utf-8":/protobuf|octet-stream/i.test(n)?n:o||"application/vnd.google.protobuf"),r.set("Cache-Control","no-store"),r.set(i,"3.2.2"),r}function F(t){if(l.test(w(t.request?.url)))return;if(!t.request)return;if(Q.test(w(t.request.url))&&!v(t.request.headers,s))return function(t){let n,s;try{n=q(t.env)}catch{return}if(n.discover&&"off"!==n.provider){if(!t.response){const e=t.request.headers;return e.delete("If-None-Match"),e.delete("If-Modified-Since"),e.set("Accept-Encoding","identity"),e.set("Cache-Control","no-cache"),{headers:e}}if(!(200!==t.response.status||v(t.response.headers,i)||Number(v(t.response.headers,"Content-Length"))>o)){try{s=e(t.response,o)}catch{return}if(s.length>o)return{body:s};try{const e=w(t.request.url).includes("/connect-state/"),n=v(t.response.headers,"Content-Type"),o=/json/i.test(n)?"json":"protobuf";if("protobuf"===o&&!/protobuf|octet-stream/i.test(n)&&(!e||n))return{body:s};const i="json"===o?function(e,t){const r=C(e),n=[];let o=0,s=0,i=0;function a(){for(;;){const e=r.charCodeAt(o);if(32!==e&&9!==e&&10!==e&&13!==e)return;o++}}function c(e){const t=o++;for(;o<r.length;){const n=r.charCodeAt(o++);if(34===n)return e?JSON.parse(r.slice(t,o)):void 0;if(n<32)throw new Error("player-json-string");if(92!==n)continue;const s=r.charCodeAt(o++);if(117===s)for(let e=0;e<4;e++){const e=r.charCodeAt(o++);if(!(e>=48&&e<=57||e>=65&&e<=70||e>=97&&e<=102))throw new Error("player-json-string")}else if(![34,92,47,98,102,110,114,116].includes(s))throw new Error("player-json-string")}throw new Error("player-json-string")}const l=function e(l,u,f=!1){if(u>64||++s>1e5)throw new Error("player-json-limit");a();const h=o,d=r.charCodeAt(o);if(123===d){const s=1===l||2===l||4===l||6===l||7===l;let f,h,d,p,y,g=!1,w=!1,b=0;o++,a();const m=125===r.charCodeAt(o);if(!m)for(;;){if(34!==r.charCodeAt(o))throw new Error("player-json-key");const n=c(s);if(a(),58!==r.charCodeAt(o++))throw new Error("player-json-colon");let i=0,m=!1,v=0;if((1!==l||t)&&6!==l||"uri"!==n?1===l&&t&&"player_state"===n?(i=2,v=2):1!==l||t||"pages"!==n?2===l&&"track"===n?(i=6,v=1):2===l&&"prev_tracks"===n?(i=5,v=2):2===l&&"next_tracks"===n?(i=5,v=4):4===l&&"tracks"===n?(i=5,v=1):6===l&&"metadata"===n?(i=7,v=2,g=!0):7===l&&"has_lyrics"===n&&(m=!0,v=1,w=!0):(i=3,v=2):(m=!0,v=1),v&&b&v)throw new Error("player-json-duplicate");b|=v,a();const A=o,E=e(i,u+1,m);m&&(7===l?(d=E,p=A,y=o):f=E),7===i&&(h=E),a();const C=r.charCodeAt(o);if(125===C)break;if(44!==C)throw new Error("player-json-object");o++,a()}const v=o++;if(7===l)return{end:v,empty:m,hasFlag:w,flag:d,flagBegin:p,flagEnd:y};if(6===l&&"string"==typeof f&&/^spotify:track:[0-9A-Za-z]{22}$/.test(f)){if(++i>300)throw new Error("player-track-limit");g?h&&(h.hasFlag?!1!==h.flag&&"false"!==h.flag||n.push({begin:h.flagBegin,end:h.flagEnd,value:!1===h.flag?"true":'"true"'}):n.push({begin:h.end,end:h.end,value:(h.empty?"":",")+'"has_lyrics":"true"'})):n.push({begin:v,end:v,value:(m?"":",")+'"metadata":{"has_lyrics":"true"}'})}return 1===l?t||"string"==typeof f&&/^spotify:[^\s?#]{1,512}$/.test(f):void 0}if(91!==d){if(34===d)return c(f);for(const e of["true","false","null"])if(r.startsWith(e,o))return o+=e.length,f?"true"===e||"false"!==e&&null:void 0;if(45===d&&o++,48===r.charCodeAt(o))o++;else{const e=r.charCodeAt(o);if(!(e>=49&&e<=57))throw new Error("player-json-value");for(;r.charCodeAt(o)>=48&&r.charCodeAt(o)<=57;)o++}if(46===r.charCodeAt(o)){o++;const e=o;for(;r.charCodeAt(o)>=48&&r.charCodeAt(o)<=57;)o++;if(o===e)throw new Error("player-json-number")}if(101===r.charCodeAt(o)||69===r.charCodeAt(o)){o++,43!==r.charCodeAt(o)&&45!==r.charCodeAt(o)||o++;const e=o;for(;r.charCodeAt(o)>=48&&r.charCodeAt(o)<=57;)o++;if(o===e)throw new Error("player-json-number")}return f?Number(r.slice(h,o)):void 0}if(o++,a(),93!==r.charCodeAt(o))for(;e(3===l?4:5===l?6:0,u+1),a(),93!==r.charCodeAt(o);)if(44!==r.charCodeAt(o++))throw new Error("player-json-array");o++}(1,0);if(a(),o!==r.length)throw new Error("player-json-shape");if(!l)return{body:e,changed:0,visited:0};if(!n.length)return{body:e,changed:0,visited:i};const u=[];let f=0;for(const e of n.sort((e,t)=>e.begin-t.begin))u.push(r.slice(f,e.begin),e.value),f=e.end;return u.push(r.slice(f)),{body:A(u.join("")),changed:n.length,visited:i}}(s,e):function(e,t){let n,o=0,s=0;function i(e,t){let r,n;return j(e,(e,o,s,i)=>{e===t&&2===o&&(r=s,n=i)}),void 0===r?"":C(e.subarray(r,n))}function a(e,t){if(!t.length)return e;let n=e.length;for(const e of t)n+=e.value.length-(e.end-e.begin);if(n>r)throw new Error("body-limit");const o=new Uint8Array(n);let s=0,i=0;for(const r of t)o.set(e.subarray(s,r.begin),i),i+=r.begin-s,o.set(r.value,i),i+=r.value.length,s=r.end;return o.set(e.subarray(s),i),o}function c(e,t,r){const n=[];let o=!1;return j(e,(e,s,i,a,c,l,u)=>{e===t&&(n.push({begin:l,end:u,value:o?new Uint8Array(0):r}),o=!0)}),o||n.push({begin:e.length,end:e.length,value:r}),a(e,n)}function l(e,t,r){const n=[];return j(e,(o,s,i,a,c,l,u)=>{if(2!==s||!t(o))return;const f=e.subarray(i,a),h=r(f,o);h!==f&&n.push({begin:l,end:u,value:x(o,h)})}),a(e,n)}function u(e,t){if(!/^spotify:track:[0-9A-Za-z]{22}$/.test(i(e,1)))return e;if(++s>300)throw new Error("player-track-limit");const r=[];let n=!1;if(j(e,(o,s,a,c,l,u,f)=>{if(o!==t)return;if(2!==s)return void(n=!0);const h=e.subarray(a,c);if("has_lyrics"!==i(h,1))return;const d=i(h,2);"true"!==d&&"false"!==d&&(n=!0),r.push({map:h,value:d,begin:u,end:f})}),n)return e;const l=[];for(const e of r)"false"===e.value&&(l.push({begin:e.begin,end:e.end,value:x(t,c(e.map,2,I(2,"true")))}),o++);return r.length||(l.push({begin:e.length,end:e.length,value:x(t,O([I(1,"has_lyrics"),I(2,"true")]))}),o++),a(e,l)}if(t)n=l(e,e=>3===e,e=>l(e,e=>7===e||19===e||20===e,e=>u(e,3)));else{if(!/^spotify:[^\s?#]{1,512}$/.test(i(e,1)))return{body:e,changed:0,visited:0};n=l(e,e=>5===e,e=>l(e,e=>4===e,e=>u(e,4)))}return{body:n,changed:o,visited:s}}(s,e);return i.visited,i.changed,i.changed?{headers:U(t,o),body:i.body}:{body:s}}catch{return{body:s}}}}}
// Original VerseLyrics native host bridge, adapter 18 (core 3.2.2).
(t);if(G.test(w(t.request.url))&&!v(t.request.headers,s))return function(t){let r;try{r=q(t.env)}catch{return}if(!r.discover||"off"===r.provider)return;if(!t.response){const e=t.request.headers;for(const t of["If-None-Match","If-Modified-Since","Accept-Encoding","Cache-Control"])e.delete(t);return e.set("Accept-Encoding","identity"),e.set("Cache-Control","no-cache"),{headers:e}}if(200!==t.response.status)return;let s;try{s=e(t.response,l.test(w(t.request.url))?n:o)}catch{return}if(v(t.response.headers,i))return{body:s};try{if(/json/i.test(v(t.response.headers,"Content-Type")))return{body:s};const e=P(s,/\/bootstrap\/v1\/bootstrap\/?(?:\?|$)/.test(w(t.request.url))?"bootstrap":"customize");return e.unsupported?{body:s}:e.changed?(e.added,e.updated,{headers:U(t,"protobuf"),body:e.body}):{body:s}}catch(e){return{body:s}}}(t);const c=w(t.request.url),d=l.exec(c),p=u.exec(c),y=f.exec(c),b=h.exec(c);if(!d&&!p&&!y&&!b||v(t.request.headers,s))return;let m;try{m=q(t.env)}catch{return}if(!t.response){if(d?!m.translate&&"off"===m.provider:!m.discover||"off"===m.provider)return;const e=t.request.headers;for(const t of["If-None-Match","If-Modified-Since","Accept-Encoding","Cache-Control"])e.delete(t);return e.set("Accept-Encoding","identity"),e.set("Cache-Control","no-cache"),d&&"protobuf"===fallbackFormat(t)&&!/protobuf|octet-stream|json/i.test(v(e,"Accept"))&&e.set("Accept","application/x-protobuf"),{headers:e}}const E=t.response.status;if(v(t.response.headers,i))return;if(200!==E&&(!d||404!==E))return;if(d&&200===E&&!m.translate&&"off"===m.provider)return;let S;try{S=e(t.response,l.test(w(t.request.url))?n:o)}catch{return}const k=()=>({body:S});if(S.length>r)return k();const N={settings:m,cache:D(t,d?{track:d[2],language:m.language,translate:m.translate}:{metadata:!0}),deadline:Date.now()+1e4};try{if(b){const e=function(e,t,r){const n="spotify:track:"+r;if(/json/i.test(t)||123===e[0]){const t=JSON.parse(C(e)),r=t?.structure?.sections;if(!Array.isArray(r)||r.length>100||r.some(e=>!g(e)))throw new Error("scroll-shape");return{format:"json",hasLyrics:r.some(e=>Object.hasOwn(e,"lyrics")),add:()=>(r.unshift({lyrics:{entityUri:n},sectionInfo:{sectionId:a}}),A(JSON.stringify(t)))}}if(!/protobuf|octet-stream/i.test(t))throw new Error("scroll-format");const o=L(e),s=o.filter(e=>1===e.number);if(1!==s.length||2!==s[0].wire)throw new Error("scroll-structure");const i=L(s[0].payload),c=i.filter(e=>1===e.number);if(c.length>100||c.some(e=>2!==e.wire))throw new Error("scroll-sections");return{format:"protobuf",hasLyrics:c.map(e=>L(e.payload)).some(e=>e.some(e=>5===e.number)),add(){const e=x(1,O([x(5,I(1,n)),x(23,I(1,a))]));return J(o,1,x(1,O([e,...i.map(e=>e.raw)])))}}}(S,v(t.response.headers,"Content-Type"),b[2]);return e.hasLyrics?k():m.discover&&"off"!==m.provider?{headers:U(t,e.format),body:e.add()}:k()}if(y){if(/json/i.test(v(t.response.headers,"Content-Type")))return k();const e=function(e){const t=L(e),r=[];for(const e of t.filter(e=>2===e.number&&2===e.wire)){const t=L(e.payload);if(10!==$(t,2,0)?.value)continue;const n=$(t,1,2);if(!n||[0,200].includes($(L(n.payload),1,0)?.value??0))for(const n of t.filter(e=>3===e.number&&2===e.wire)){const o=L(n.payload),s=R(o,2),i=/^spotify:track:([0-9A-Za-z]{22})$/.exec(s)?.[1],a=$(o,1,2);if(!i||a&&![0,200].includes($(L(a.payload),1,0)?.value??0))continue;const c=$(o,3,2);if(!c)continue;const l=L(c.payload),u=R(l,1),f=$(l,2,2);if(/(?:^|\/)spotify\.metadata\.Track$/.test(u)&&f)try{const s=_(f.payload,T(i));if(r.push(Object.assign(s,{group:e,groupFields:t,entity:n,entityFields:o,anyFields:l})),r.length>100)throw new Error("extended-track-limit")}catch(e){if("extended-track-limit"===e.message)throw e}}}return{records:r,writeFlags(e){const r=new Map,n=new Map;for(const t of e){const e=J(t.fs,18,M(18,1)),o=J(t.anyFields,2,x(2,e));let s=J(t.entityFields,3,x(3,o));const i=$(t.entityFields,1,2);if(i){let e=J(L(i.payload),2,null);e=J(L(e),4,M(4,300)),e=J(L(e),5,M(5,0)),s=J(L(s),1,x(1,e))}r.set(t.entity,x(3,s)),n.set(t.group,t.groupFields)}const o=new Map;for(const[e,t]of n){let n=O(t.map(e=>r.get(e)||e.raw));const s=$(t,1,2);if(s){let e=J(L(s.payload),2,M(2,300));e=J(L(e),3,M(3,0)),n=J(L(n),1,x(1,e))}o.set(e,x(2,n))}return O(t.map(e=>o.get(e)||e.raw))}}}(S);for(const t of e.records)B(N,t);const r=m.discover&&"off"!==m.provider?e.records.filter(e=>!1===e.hasLyrics):[];return e.records.length,r.length&&r.length,r.length?{headers:U(t,"protobuf"),body:e.writeFlags(r)}:k()}if(p){if(/json/i.test(v(t.response.headers,"Content-Type")))return k();const e=_(S,p[2]);return B(N,e),!1===e.hasLyrics&&m.discover&&"off"!==m.provider?{headers:U(t,"protobuf"),body:J(e.fs,18,M(18,1))}:(!0===e.hasLyrics||m.discover,k())}return k()}catch{return k()}finally{N.cache.save()}}const G=new RegExp("^https://("+c+")(?::443)?/(?:user-customization-service/v1/customize|bootstrap/v1/bootstrap|v1/customize)/?(?:\\?.*)?$"),W="ios-feature-lyrics",V="enable_has_lyrics_check_bypass";function Z(e){const t=L(e),r=t.filter(e=>3===e.number&&2===e.wire);if(!r.length||r.length>5e3)return null;const n=t.filter(e=>1===e.number),o=t.filter(e=>2===e.number);if(1!==n.length||2!==n[0].wire||!R(t,1)||o.some(e=>0!==e.wire))return null;let s=!1;const i=[];for(const e of r){let t,r;try{t=L(e.payload);const n=t.filter(e=>1===e.number);if(1!==n.length||2!==n[0].wire)continue;if(r=L(n[0].payload),1!==r.filter(e=>1===e.number).length||1!==r.filter(e=>2===e.number).length)continue;if(R(r,1)!==W)continue;if(s=!0,R(r,2)!==V)continue}catch{continue}const n=t.filter(e=>[3,4,5].includes(e.number));if(1!==n.length||3!==n[0].number||2!==n[0].wire)throw new Error("lyrics-gate-type");const o=L(n[0].payload),a=o.filter(e=>1===e.number);if(a.length>1||a.some(e=>0!==e.wire||![0,1].includes(e.value)))throw new Error("lyrics-gate-value");i.push({entry:e,ef:t,bool:o,value:a[0]?.value??0})}return s?{fs:t,entries:r,targets:i}:null}function P(e,t="customize"){if(e.length>r)throw new Error("body-limit");if("bootstrap"===t){let t=e;const r=[];for(const n of[2,1,1]){let o;try{o=L(t)}catch{return{changed:!1,body:e,unsupported:!0}}const s=o.filter(e=>e.number===n);if(1!==s.length||2!==s[0].wire)return{changed:!1,body:e,unsupported:!0};r.push({fs:o,number:n}),t=s[0].payload}const n=P(t);if(!n.changed)return{...n,body:e,...void 0!==n.depth?{depth:n.depth+3}:{}};let o=n.body;for(let e=r.length-1;e>=0;e--){const{fs:t,number:n}=r[e];o=J(t,n,x(n,o))}return{...n,body:o,depth:n.depth+3}}let n=e;const o=[];for(let t=0;t<=3;t++){let r,s;try{r=Z(n)}catch(e){if(/^lyrics-gate-/.test(e.message))throw e}if(r){const n=new Map;let s=0,i=0;for(const e of r.targets){if(1===e.value)continue;const t=J(e.bool,1,M(1,1));n.set(e.entry,x(3,J(e.ef,3,x(3,t)))),s++}const a=r.fs.map(e=>n.get(e)||e.raw);if(!r.targets.length){const e=O([I(1,W),I(2,V)]);a.push(x(3,O([x(1,e),x(3,M(1,1))]))),i=1}if(!s&&!i)return{changed:!1,body:e,matched:r.targets.length,added:i,updated:s,depth:t};let c=O(a);for(let e=o.length-1;e>=0;e--)c=J(o[e],1,x(1,c));return{changed:!0,body:c,matched:r.targets.length,added:i,updated:s,depth:t}}if(3===t)break;try{s=L(n)}catch{break}const i=s.filter(e=>1===e.number);if(1!==i.length||2!==i[0].wire)break;if(s.some(e=>2===e.number&&2===e.wire))break;o.push(s),n=i[0].payload}return{changed:!1,body:e,unsupported:!0}}const Q=new RegExp("^https://("+c+")(?::443)?/(?:context-resolve/v1/spotify(?::|%3[aA])[^?#\\s/]{1,512}|connect-state/v1/devices/[0-9A-Za-z_-]{16,128})/?(?:\\?.*)?$");let K,Y=!1,H=0;function X(e){Y||(Y=!0,void 0!==K&&"function"==typeof clearTimeout&&clearTimeout(K),K=void 0,$done(e||{}))}class ee{constructor(e){this.source=e||{},this.array=Array.isArray(e),this.pairs=null}get(e){if(e=e.toLowerCase(),this.pairs){const t=this.pairs.find(t=>t[0].toLowerCase()===e);return t?String(t[1]):null}if(this.array){const t=this.source.find(t=>t.field.toLowerCase()===e);return t?String(t.value):null}for(const t in this.source)if(Object.hasOwn(this.source,t)&&t.toLowerCase()===e)return String(this.source[t]);return null}materialize(){return this.pairs||(this.pairs=this.array?this.source.map(e=>[e.field,e.value]):Object.entries(this.source)),this.pairs}delete(e){const t=this.materialize(),r=e.toLowerCase();let n=0;for(let e=0;e<t.length;e++)t[e][0].toLowerCase()!==r&&(t[n++]=t[e]);t.length=n}set(e,t){this.delete(e),this.pairs.push([e,String(t)])}native(){return this.pairs?this.array?this.pairs.map(([e,t])=>({field:e,value:t})):Object.fromEntries(this.pairs):this.source}}function te(e,t=r){if(null==e)return new Uint8Array(0);if("string"==typeof e)return A(e,t);if(Number(e.byteLength)>t){const t=new Error("body-limit");throw t.bodyBytes=e.byteLength,t}if(ArrayBuffer.isView(e))return new Uint8Array(e.buffer,e.byteOffset,e.byteLength);if("[object ArrayBuffer]"===Object.prototype.toString.call(e))return new Uint8Array(e);throw new Error("unsupported native body")}function re(e){if("number"==typeof e)return e;const t=/^(?:HTTP\/\S+\s+)?([1-5]\d\d)(?:\s|$)/.exec(String(e));return t?Number(t[1]):0}function ne(){const e=["TRANSLATION_ENABLED","TARGET_LANGUAGE","FALLBACK_PROVIDER","DISCOVER_MISSING","MEMORY_MODE"],t=Object.create(null);return"undefined"!=typeof $argument&&function(r){if("string"==typeof r)for(const n of r.split("&")){const r=n.indexOf("=");if(r<1)continue;const o=decodeURIComponent(n.slice(0,r));e.includes(o)&&(t[o]=decodeURIComponent(n.slice(r+1)))}else if(r&&"object"==typeof r)for(const n of e)null!=r[n]&&(t[n]=String(r[n]))}($argument),t}const oe={get:e=>$persistentStore.read(e),set(e,t){Y||$persistentStore.write(t,e)},getJSON(e){try{const t=oe.get(e);return"string"==typeof t&&t.length<=128e3?JSON.parse(t):null}catch{return null}},setJSON(e,t){Y||oe.set(e,JSON.stringify(t))}};try{!function(){if("undefined"==typeof $request||!$request?.url)return X({});const e={request:{url:$request.url,method:$request.method,headers:new ee($request.headers)},env:ne(),storage:oe};"undefined"!=typeof $response&&$response&&(e.response=function(e,t,n){let o;return{status:re(e),headers:new ee(t),boundedBytes:function(e=r){if(o||(o=te(n,e)),o.byteLength>e){const e=new Error("body-limit");throw e.bodyBytes=o.byteLength,e}return o}}}($response.statusCode??$response.status,$response.headers,$response.body)),H=Date.now()+12e3;const t=F(e);if(!t||Y)return X({});if(!t.headers&&void 0===t.status&&t.body&&e.response){const r=e.response.boundedBytes(),n=t.body.buffer===r.buffer&&t.body.byteOffset===r.byteOffset;if(t.body.length===r.length&&(n||t.body.every((e,t)=>e===r[t])))return X({})}const n={};if(t.headers&&(n.headers=t.headers.native()),void 0!==t.status&&(n.status=t.status),void 0!==t.body&&e.response){const e=te(t.body);n.body=e}X(n)}()}catch{X({})}})();

})($done);
