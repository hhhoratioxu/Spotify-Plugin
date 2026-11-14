import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const policy = JSON.parse(readFileSync(new URL('source-policy.json',root)));
const approved = Object.entries(policy.providers).filter(([,p])=>p.enabled).map(([name])=>name);
const base = new URL(process.env.LYRICS_ASSET_BASE || 'http://127.0.0.1:8765/');
if (!['http:','https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw Error('Invalid asset base');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const templates = JSON.parse(readFileSync(new URL('history/3.2.2/base.json',root))).files;
const names = ['FALLBACK_PROVIDER','DISCOVER_MISSING','MEMORY_MODE','FALLBACK_OFFSET_MS','FALLBACK_MODE','NETWORK_MODE'];
const provider = approved.length ? 'auto' : 'off';
const argumentsText = `FALLBACK_PROVIDER=${provider}&DISCOVER_MISSING=true&MEMORY_MODE=compact&FALLBACK_OFFSET_MS=0&FALLBACK_MODE=synced&NETWORK_MODE=online`;
const allowed = approved.length ? ['auto',...approved,'off'] : ['off'];
const published = [];
for (const [client,extension] of [['Loon','lpx'],['Surge','sgmodule']]) {
  const path = `${client}/script/SpotifyLyrics.${extension}`;
  let source = templates[path];
  if (!source) throw Error('Missing historical template '+path);
  source = source.replace(/^#!name = .*$/m,'#!name = Spotify Lyrics+ · 本地候选（未发布）')
    .replace(/^#!desc = .*$/m,'#!desc = 恢复自 VerseLyrics 3.2.2；只补充缺失歌词，保留全部原生歌词。未核实授权的来源关闭；未完成实机验收。')
    .replace(/^#!author = .*$/m,'#!author = Horatio')
    .replace(/^#!date = .*$/m,'#!date = 2026-11-13')
    .replace(/https:\/\/raw\.githubusercontent\.com\/hhhoratioxu\/Proxy\/[0-9a-f]{40}\//g,base.href);
  if (client === 'Loon') {
    const args = `[Argument]\nFALLBACK_PROVIDER = select,${allowed.map(x=>JSON.stringify(x)).join(',')},type=string,tag=已核实授权的歌词源\nDISCOVER_MISSING = switch,true,type=boolean,tag=尝试补充无词入口\nMEMORY_MODE = select,"compact","standard",type=string,tag=缓存容量\nFALLBACK_OFFSET_MS = select,0,-500,500,-1000,1000,type=number,tag=补词偏移毫秒\nFALLBACK_MODE = select,"synced","fast",type=string,tag=同步或首份可用歌词\nNETWORK_MODE = select,"online","cache-only",type=string,tag=插件联网模式\n\n`;
    source = source.replace(/\[Argument\][^]*?(?=\[Rewrite\])/,args)
      .replace(/\{\$\{TRANSLATION_ENABLED\}[^]*?\$\{REPLACE_UNSYNCED\}\}/g,'{'+names.map(n=>'${'+n+'}').join(', ')+'}')
      .replaceAll('${TRANSLATION_ENABLED}','false');
    if (!approved.length) source = source.replace(/\[Rewrite\][^]*?(?=\[Script\])/,'[Rewrite]\n\n');
    // Disabled policies should not make Loon buffer a response at all.
    source = source.replace(/^(response if .*?)( then script\()/gm,(_,guard,action)=>guard+' && ${FALLBACK_PROVIDER} ~= /^(?:'+(approved.length ? ['auto',...approved].join('|') : 'a^')+')$/'+action);
    if (/\$\{(?:TARGET_LANGUAGE|SOURCE_TRANSLATIONS|PREFERRED_SOURCE|FETCH_ARTWORK_COLOR|REPLACE_UNSYNCED)\}/.test(source)) throw Error('Undeclared Loon argument');
  } else {
    source = source.replace(/argument=[^,\n]+/g,'argument='+argumentsText)
      .replace('# 改设置时同步修改三条 Script 的 argument；翻译目标可改为 zh-TW。','# 改设置时同步修改三条 Script 的 argument；本地候选只补无词，不翻译或替换原生歌词。');
  }
  const target = new URL('dist/'+path,root);
  mkdirSync(new URL('./',target),{recursive:true});
  writeFileSync(target,source);
  published.push({path,assetBase:base.href,approvedSources:approved,localOnly:true});
}
writeFileSync(new URL('dist/import-manifest.json',root),JSON.stringify(published,null,2)+'\n');
console.log(JSON.stringify({localImports:published.length,approvedSources:approved,assetBase:base.href}));
