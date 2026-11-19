// Spotify Desktop's observed metadata JSON uses a hex gid and omits false
// has_lyrics values. Only a complete, identity-matched catalog track is eligible.
// No network, credential or account access. An optional native cache handoff
// receives only the identity validated here, after the output passes its bound.
export function macMetadataEntry(request, response, env, codec) {
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
