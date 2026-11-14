export const displayName = 'SpotifyLyrics';
export const loonDescription = [
  'iOS & iPadOS & macOS',
  '1.补充 iPhone、iPad 缺失歌词',
  '2.显示逐行同步歌词',
  '3.翻译歌词与选择目标语言',
  '4.选择歌词来源与缓存容量',
  '5.Mac 显示双语歌词（无词补全测试中）'
].join('\\n');
export function setDisplayName(profile, client) {
  const pattern = client === 'Egern' ? /^name: .*$/m : /^#!name = .*$/m;
  if (!pattern.test(profile)) throw Error('Missing display name: ' + client);
  return profile.replace(pattern, client === 'Egern' ? 'name: ' + displayName : '#!name = ' + displayName);
}
