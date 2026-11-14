# 待修复与待验收问题

## 日文歌曲翻译

2026-11-15 用户反馈：以下两个公开曲目没有显示翻译：

- [Spotify 曲目 39HrUxcvKF3jtLz7fUDWXc](https://open.spotify.com/track/39HrUxcvKF3jtLz7fUDWXc)
- [Spotify 曲目 6149wOhItvVX0zoa1KK5hw](https://open.spotify.com/track/6149wOhItvVX0zoa1KK5hw)

当前 `src/spotify-lyrics.js` 的整曲翻译门槛在中文目标下要求 `englishSong(...)` 成立；显式日语来源会被跳过。这是旧版翻译策略的边界。两首曲目的实际元数据、线上响应、翻译来源与原生显示尚待逐项验证，不能只据链接宣称实机根因或修复成功。

后续在新仓库实现日语策略变更并测试日语标签、假名、纯汉字句、混合语言、中文原词保留、翻译失败回退、缓存与 JSON / Protobuf；不伪造时间轴，不以此改变其他来源或播放行为。此文件仅保存问题，不随迁移部署行为修改。

## macOS 无词入口与 iPhone 内存

详见 [验收状态](acceptance.md) 与 [2026-11-14 实测记录](repair-2026-11-14.md)。Mac 无词目标仍未通过，iPhone 原生低于 50,000,000 字节仍未验证；用户目前无法设置 iPhone 镜像。拆仓和离线回归不改变这些结论。
