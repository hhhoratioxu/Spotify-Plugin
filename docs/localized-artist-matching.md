# SpotifyLyrics Dev · 录音署名与同录音版本

版本日期为 **2026-11-19 09:17:39（UTC+8）**。手机在 Loon 保留 `mobile`，Mac 选择 `macOS`。[Loon Dev 订阅](https://raw.githubusercontent.com/hhhoratioxu/Spotify-Plugin/dev/Loon/script/SpotifyLyrics.lpx)

补词先走原有匹配。遇到来源查无匹配，且 Spotify 元数据提供有效 ISRC 时，可在原请求预算内向 MusicBrainz 查一次录音署名。只接受符合曲名和时长的录音。有多个同码登记时优先验证指向同一首 Spotify 曲目的公开链接。缺少该链接时，必须核对所有 Spotify 署名和目录别名的一一对应。得到的别名按艺人分组再搜索与比对，适用于目录收录的各地区艺人和语种。仅有弱名称相似度、多人别名冲突，以及缺少录音证据的跨语种署名继续保留原响应。[MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) · [艺人别名](https://musicbrainz.org/doc/Aliases)

查询中文来源时优先使用已确认的中文署名。匹配仍核对曲名、全部艺人、时长、专辑和录音版本。已有有效歌词和翻译可继续复用，旧的查无结果记录按新的来源修订重新查询。中文原词保留，其他语言按插件选择的目标语种翻译。现有双语署名及 Jay Chou、Stefanie Sun 等已确认别名也可以直接匹配。

曲目无法播放时，在 Loon 的 SpotifyLyrics 设置中填入公开 Spotify 曲目链接或 ISRC，然后手动运行「查找 Spotify 同录音版本」。插件从公开目录找出同一录音的其他 Spotify 链接，最多展示三个，点击通知打开。候选是否可播由 Spotify 当前账号和地区决定。曲目下架或账号所在地区没有获授权发行时无法通过插件播放。[Spotify 曲目重新关联规则](https://developer.spotify.com/documentation/web-api/concepts/track-relinking)

补词自动查询只发送公开 ISRC，单次最大 32 KiB、等待至多 1.2 秒。版本查找只在手动运行时查询，最多两个请求。两者共用 MusicBrainz 协作限频，普通播放和原生歌词照旧运行。[MusicBrainz 限频](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)

Loon Mac 的 Dev 构建也纳入先前的桌面适配。已有的 JSON 曲目信息可交给原有缓存，成功取得的备用歌词包含桌面所需的预览字段，Spotify 预载另一首歌时当前曲目的翻译可继续。Mac 验收以歌词功能为准，iOS 的目标为整个 Loon VPN 扩展峰值低于 40,000,000 字节。

GitHub 仓库更名为 [Spotify-Plugin](https://github.com/hhhoratioxu/Spotify-Plugin)。Loon 内现有插件名保持 SpotifyLyrics。本次按用户要求构建和发布 Dev，未运行回归或设备测试。
