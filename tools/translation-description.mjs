export const translationDescription='中文原词保持；翻译其他语言，混合句保留中文';

export function setTranslationDescription(profile) {
  return profile
    .replaceAll('备用源按需初始化，减少英语歌词重复检查；','备用源按需初始化；')
    .replaceAll('中文目标仅翻译英语歌曲；中文及其他语言歌曲夹英文不翻译',translationDescription)
    .replaceAll('中文目标仅翻译英语歌曲','中文原词保持，其他语言按需翻译');
}
