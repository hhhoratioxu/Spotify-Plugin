// Mac-only advisory network slots. Spotify Desktop preloads other tracks while
// the current lyric/translation request is pending. Those tracks must not
// retire the current request. Same-track deduplication and a four-slot bound
// reuse the existing core's lease protocol; no polling or extra HTTP.
export function macTrackStorage(storage, url) {
  if (typeof url !== 'string') return storage;
  const match = /^https:\/\/(?:spclient\.wg|[a-z0-9-]+-spclient)\.spotify\.com(?::443)?\/color-lyrics\/v2\/track\/([0-9A-Za-z]{22})(?:\/image\/[^?#\s]+)?\/?(?:\?[^#\s]*)?$/.exec(url);
  if (!match) return storage;
  const track = match[1], logical = 'VerseLyrics.v1.network', key = 'VerseLyrics.v1.network.mac';
  function active() {
    try {
      const raw = storage.read(key);
      if (typeof raw !== 'string' || raw.length > 4096) return [];
      const rows = JSON.parse(raw), now = Date.now();
      if (!Array.isArray(rows) || rows.length > 4) return [];
      return rows.filter(row => typeof row?.owner === 'string' && row.owner.length > 0 && row.owner.length <= 64 && /^[0-9A-Za-z]{22}$/.test(row.track) && Number.isFinite(row.expires) && row.expires > now && row.expires <= now+15000);
    } catch { return []; }
  }
  return {
    read(name) {
      if (name !== logical) return storage.read(name);
      const rows = active(), own = rows.filter(row => row.track === track);
      // A full desktop budget still returns busy immediately. The original
      // core can reuse a warm cache without starting a fifth transport.
      return JSON.stringify(own.length || rows.length < 4 ? own : rows);
    },
    write(value, name) {
      if (name !== logical) return storage.write(value,name);
      if (typeof value !== 'string' || value.length > 4096) return false;
      let incoming; try { incoming = JSON.parse(value); } catch { return false; }
      if (!Array.isArray(incoming) || incoming.length > 4) return false;
      const now = Date.now();
      const own = incoming.filter(row => row?.track === track && typeof row.owner === 'string' && row.owner.length > 0 && row.owner.length <= 64 && Number.isFinite(row.expires) && row.expires > now && row.expires <= now+15000)
        .map(row => ({owner:row.owner,track,expires:row.expires}));
      if (own.length > 1) return false;
      const others = active().filter(row => row.track !== track);
      if (others.length+own.length > 4) return false;
      return storage.write(JSON.stringify([...others,...own]),key);
    }
  };
}
