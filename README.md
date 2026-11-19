# SpotifyLyrics

> **Dev 更新于 2026-11-19 09:01:52（UTC+8）。** 补词识别 Jay Chou／周杰伦、Stefanie Sun／孙燕姿等已确认的跨语言署名，并集成 Loon Mac 补词与逐行翻译适配。本版按用户要求直接构建与发布，设备验证待补。[版本说明](docs/localized-artist-matching.md)

作者：Horatio / [hhhoratioxu](https://github.com/hhhoratioxu)。从原 [Proxy](https://github.com/hhhoratioxu/Proxy) 项目完整迁出的 Spotify 歌词补全与翻译插件，保留已有 **3.2.2** 核心、来源、匹配、时间轴、缓存和各客户端原生适配。

项目统一在 [hhhoratioxu/SpotifyLyrics](https://github.com/hhhoratioxu/SpotifyLyrics) 维护。完整迁移的安装链和历史校验见 [GitHub 迁移记录](evidence/github-migration-verification.json)。

**正式版历史：[v3.2.3 非中文歌词翻译修复](https://github.com/hhhoratioxu/SpotifyLyrics/releases/tag/v3.2.3)：中文原词保持，其他语言进入翻译；独立检查 626 项 Node / 18 项 Python、1011 项当前核心兼容与 2248 项历史基线通过。该正式版记录保留；本测试分支使用另一组经过核验的固定运行资源。** 详见 [多语言修复记录](docs/translation-2026-11-15.md)及[公开发布校验](evidence/release-v3.2.3.json)。

## 安装

| 客户端 | 订阅 / 导入文件 | 说明 |
| --- | --- | --- |
| Loon | [SpotifyLyrics.lpx](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/dev/Loon/script/SpotifyLyrics.lpx) | iPhone / iPad 默认 `mobile`，Mac 选择 `macOS` |
| Surge | [SpotifyLyrics.sgmodule](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/dev/Surge/script/SpotifyLyrics.sgmodule) | Surge 模块 |
| Egern | [SpotifyLyrics.yaml](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/dev/Egern/script/SpotifyLyrics.yaml) | Egern 插件 |
| Quantumult X | [SpotifyLyrics.conf](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/dev/QuantumultX/script/SpotifyLyrics.conf) | Quantumult X 重写 |
| Shadowrocket | [SpotifyLyrics.sgmodule](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/dev/Shadowrocket/script/SpotifyLyrics.sgmodule) | Shadowrocket 模块 |

使用 Dev 时，将现有 SpotifyLyrics 的订阅改用上表地址，并保持只启用一份 SpotifyLyrics。Loon 详情中的 Version Date 应为 `2026-11-19 09:01:52`。正式版地址见 [beta.2 发布记录](docs/releases/v3.2.4-beta.2.md)。

Loon 的插件名称与编号功能描述保持现有 WeatherKit 风格。五个入口的运行脚本均固定到新仓库的完整 Git 提交，哈希见 [runtime-release.json](provenance/runtime-release.json)，不再向旧 Proxy 下载运行脚本。

## 当前功能与限制

- 原有补词、逐行同步、翻译目标、来源与缓存参数保留；Spotify 原生有词时按原逻辑处理，不在迁移时更换核心。
- Loon Mac 提供原生逐行双语和无词补全适配，实际覆盖取决于来源收录情况及 Spotify 是否发出歌词请求。详见 [Dev 版本说明](docs/localized-artist-matching.md)。
- iPhone 的验收目标为整个 Loon VPN 扩展峰值低于 40,000,000 字节，目前等待实机数据。
- 当前维护源码已取消整曲英语门槛：中文原词保持，其他语言使用所选翻译目标。两首反馈曲目的真实客户端显示仍待验证；v3.2.2 固定下载链接保留旧版，持续更新请使用下方新仓库 main 订阅。见 [多语言修复](docs/translation-2026-11-15.md)。
- Clash / Mihomo 没有本项目已实现的歌词正文改写入口。Spotify 路由仍由 Proxy 项目维护。

完整证据与边界见 [验收状态](docs/acceptance.md) 和 [macOS / iPhone 修复记录](docs/repair-2026-11-14.md)。

## 开发与验证

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run test:baseline
npm run check:independent
```

构建使用本仓库 `src/`、锁定依赖和经过 SHA-256 核验的来源快照，不读取父 Proxy 的 Git 对象。`check:independent` 会在仓库之外、无 Git 数据库的临时目录重新安装依赖、构建并回归，不启动客户端或播放音乐。

- `src/`：当前维护源码，来自已恢复的工作基线。
- `history/3.2.2/`：125 个原始历史文件，字节保持不变。
- 各客户端 `script/`：实际安装入口与运行脚本；`Docs/` 保存原生适配说明。
- `Loon/Development/`、`evidence/`：Mac 适配、离线测试、内存工具与实测记录，诊断不会自动部署。
- `provenance/`：191 个逻辑来源对象、恢复清单、运行脚本哈希和旧 / 新 Git 提交对照。
- `archive/`：历史 Egern 与隔离实验。默认构建不使用隔离实验核心。

原 Proxy 中的 **101 个 Spotify 相关提交**保存在 [archive/proxy-history 分支](https://github.com/hhhoratioxu/SpotifyLyrics/tree/archive/proxy-history)，并连接到当前开发历史。原作者、日期、提交说明与文件内容保留；过滤掉其他项目后提交 ID 会变化，对照见 [git-history.json](provenance/git-history.json)。历史版本中的原链接仅作来源记录保留。

私有迁移备份、node_modules、客户端配置、证书和账户凭据不上传。其他 Proxy、WeatherKit、MapKit 项目保持原状。详见 [迁移记录](docs/migration.md)、[许可证与来源](NOTICE.md)、[Loon 官方文档适配记录](Loon/Docs/OfficialReference.md)。
