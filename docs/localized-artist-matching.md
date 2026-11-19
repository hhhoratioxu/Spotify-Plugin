# SpotifyLyrics Dev · 跨语言艺人名匹配

版本日期为 **2026-11-19 09:01:52（UTC+8）**。手机在 Loon 保留 `mobile`，Mac 选择 `macOS`。[Loon Dev 订阅](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/dev/Loon/script/SpotifyLyrics.lpx)

Spotify 的公开目录会按显示语言呈现不同艺人名。补词在查找和比对时识别已确认的完整别名，包含 **Jay Chou / 周杰倫 / 周杰伦**、**Stefanie Sun / Yanzi Sun / 孫燕姿 / 孙燕姿**，以及此前支持的 **Silence Wang / 汪苏泷**。原有的完整双语署名匹配继续适用。带空格、连写、大小写和简繁的变化沿用名称规范化。[Spotify 的周杰伦](https://open.spotify.com/artist/2O8QerAITHplz1zK4qbFBF) · [Spotify 的孙燕姿](https://open.spotify.com/embed?uri=spotify%3Aalbum%3A1WFT31Q7VuZAhiO41PKdWO) · [Apple Music 的 Yanzi Sun](https://music.apple.com/us/artist/yanzi-sun/83405200)

查询中文来源时采用已确认的中文名。匹配仍核对曲名、全部艺人、时长、专辑和录音版本。来源查不到或存在歧义时保留原响应。已有有效歌词和翻译可继续复用，旧的查无结果记录按新的来源修订重新查询。中文原词保留，其他语言按插件选择的目标语种翻译。

Loon Mac 的 Dev 构建也纳入先前的桌面适配。已有的 JSON 曲目信息可交给原有缓存，成功取得的备用歌词包含桌面所需的预览字段，Spotify 预载另一首歌时当前曲目的翻译可继续。Mac 验收以歌词功能为准，iOS 的目标为整个 Loon VPN 扩展峰值低于 40,000,000 字节。

本次按用户要求仅构建和发布 Dev，未运行回归或设备测试。
