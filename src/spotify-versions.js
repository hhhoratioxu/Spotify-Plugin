// Manual Loon action. Finds other public Spotify listings of a recording.
// Playback and market availability are decided by the Spotify client.
(() => {
  "use strict";
  const catalog = "https://musicbrainz.org/ws/2/";
  const spotify = "https://open.spotify.com/track/";
  const rateKey = "VerseLyrics.v1.recordingCatalogNext";
  const limit = 65536;

  function trackId(value) {
    if (typeof value !== "string" || value.length > 1024) return "";
    const uri = /^spotify:track:([0-9A-Za-z]{22})$/.exec(value);
    if (uri) return uri[1];
    return /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z0-9]{2,8})?\/)?track\/([0-9A-Za-z]{22})\/?(?:[?#]\S*)?$/i.exec(value)?.[1] ?? "";
  }

  function lookup(path) {
    return new Promise((resolve, reject) => {
      let finished = false;
      $httpClient.get({
        url: catalog + path,
        headers: {Accept:"application/json","User-Agent":"SpotifyLyrics/3.2.2 (https://github.com/hhhoratioxu/Spotify-Plugin)"},
        timeout: 2200, "binary-mode": false, "auto-cookie": false, "auto-redirect": false, insecure: false
      }, (error, response, body) => {
        if (finished) return;
        finished = true;
        if (error) return reject(Error("catalog-request"));
        const status = Number(response?.status ?? response?.statusCode);
        if (status === 404) return resolve(null);
        if (status === 429 || status === 503) {
          try { $persistentStore.write(String(Date.now() + 15000),rateKey); } catch {}
          return reject(Error("catalog-busy"));
        }
        const headers = response?.headers ?? {};
        const lengthKey = Object.keys(headers).find(key => key.toLowerCase() === "content-length");
        if (status !== 200 || lengthKey && Number(headers[lengthKey]) > limit || typeof body !== "string" || body.length > limit) {
          return reject(Error("catalog-response"));
        }
        try { resolve(JSON.parse(body)); } catch { reject(Error("catalog-response")); }
      });
    });
  }

  async function request(path) {
    const next = Number($persistentStore.read(rateKey));
    const wait = next - Date.now();
    if (wait > 1200 && wait <= 60000) throw Error("catalog-busy");
    if (wait > 0 && wait <= 1200) {
      await new Promise(resolve => setTimeout(resolve,wait + 20));
      if (Number($persistentStore.read(rateKey)) > Date.now()) throw Error("catalog-busy");
    }
    $persistentStore.write(String(Date.now() + 1100),rateKey);
    return lookup(path);
  }

  function catalogTrackLinks(recording) {
    if (!Array.isArray(recording?.relations) || recording.relations.length > 128) return [];
    const ids = new Set();
    for (const relation of recording.relations) {
      if (relation?.["target-type"] !== "url" || relation.ended === true) continue;
      const id = trackId(relation.url?.resource);
      if (id) ids.add(id);
    }
    return [...ids];
  }

  function message(subtitle, content, url) {
    $notification.post("Spotify 同录音版本",subtitle,content,url ? {openUrl:url} : undefined);
  }

  async function findVersions() {
    const argument = typeof $argument === "object" ? $argument : null;
    const input = typeof argument?.VERSION_TRACK === "string" ? argument.VERSION_TRACK.trim() : "";
    const original = trackId(input);
    const isrc = catalogISRC(input.replace(/^isrc\s*:\s*/i,""));
    if (!original && !isrc) {
      message("请先填写曲目","在插件设置中粘贴 Spotify 曲目链接或录音 ISRC。");
      return;
    }
    let recording;
    if (original) {
      const url = spotify + original;
      const link = await request("url?resource=" + encodeURIComponent(url) + "&inc=recording-rels&fmt=json");
      if (trackId(link?.resource) === original && Array.isArray(link.relations) && link.relations.length <= 32) {
        const ids = new Set(link.relations
          .filter(item => item?.["target-type"] === "recording" && item.ended !== true)
          .map(item => item.recording?.id)
          .filter(id => typeof id === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)));
        if (ids.size === 1) {
          const id = ids.values().next().value;
          const result = await request("recording/" + id + "?inc=url-rels&fmt=json");
          if (result?.id === id && catalogTrackLinks(result).includes(original)) recording = result;
        }
      }
    } else {
      const result = await request("isrc/" + isrc + "?inc=url-rels&fmt=json");
      if (catalogISRC(result?.isrc) === isrc && Array.isArray(result.recordings) && result.recordings.length === 1) {
        recording = result.recordings[0];
      }
    }
    const releases = catalogTrackLinks(recording).filter(id => id !== original).slice(0,3);
    if (!releases.length) {
      message("未找到同录音的其他 Spotify 版本","可在 Spotify 的艺人页查看其他正式发行。");
      return;
    }
    const title = typeof recording.title === "string" ? recording.title.slice(0,100) : "录音版本";
    releases.forEach((id,index) => {
      message(title + " (" + (index + 1) + "/" + releases.length + ")",
        "点此交由 Spotify 打开。可播放性以当前账号和地区为准。",spotify + id);
    });
  }

  findVersions().catch(error => {
    message(error.message === "catalog-busy" ? "公开目录暂时繁忙" : "无法读取公开目录","请稍后手动再试。");
  }).finally(() => $done({}));
})();
