# 待修复与待验收问题

## 日文及其他非中文歌词翻译

2026-11-15 用户反馈：以下两个公开曲目没有显示翻译：

- [Spotify 曲目 39HrUxcvKF3jtLz7fUDWXc](https://open.spotify.com/track/39HrUxcvKF3jtLz7fUDWXc)
- [Spotify 曲目 6149wOhItvVX0zoa1KK5hw](https://open.spotify.com/track/6149wOhItvVX0zoa1KK5hw)

旧版在中文目标下要求 `englishSong(...)` 成立，显式日语会被跳过。用户随后明确要求“除了中文都要翻译”。现已在本地取消该门槛并恢复对应构建路径，公共元数据已核对；235 项新规则 / 脚本测试、1011 项当前核心兼容检查和自写文本的真实服务请求通过。尚未推送到线上版本，也没有验证这两首曲目的真实原生显示。详见 [修复记录](translation-2026-11-15.md)。

已覆盖日语标签、假名、汉字消歧、混合语言、中文原词保留、翻译失败回退、缓存与 JSON / Protobuf。后续仍须发布新资源并取得真实客户端证据；不伪造时间轴，不将模拟测试写成播放或显示已通过。

## macOS 无词入口与 iPhone 内存

详见 [验收状态](acceptance.md) 与 [2026-11-14 实测记录](repair-2026-11-14.md)。Mac 无词目标仍未通过，iPhone 原生低于 50,000,000 字节仍未验证；用户目前无法设置 iPhone 镜像。拆仓和离线回归不改变这些结论。
