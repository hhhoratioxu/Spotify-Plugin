// Isolated availability candidate. No network, storage, timers or logging.
// Only explicit false in a complete, identity-matched metadata JSON is eligible.
export function macJSONMetadata(request, response, env, codec) {
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
