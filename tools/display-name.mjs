export const displayName = 'SpotifyLyrics';
export const loonDescription = [
  'iOS & iPadOS & macOS',
  '1.尝试补充缺失歌词',
  '2.显示逐行同步歌词',
  '3.翻译歌词与选择目标语言',
  '4.选择歌词来源与缓存容量',
  '5.跨语言艺人名匹配',
  '6.Mac 逐行双语歌词与无词补全适配（Dev）'
].join('\\n');
export function setDisplayName(profile, client) {
  const pattern = client === 'Egern' ? /^name: .*$/m : /^#!name = .*$/m;
  if (!pattern.test(profile)) throw Error('Missing display name: ' + client);
  return profile.replace(pattern, client === 'Egern' ? 'name: ' + displayName : '#!name = ' + displayName);
}
