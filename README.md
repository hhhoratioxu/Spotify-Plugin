# SpotifyLyrics

> **v3.2.4-beta.2 启动内存优化测试版**。用户反馈 beta.1 仍断开 iPhone Loon VPN，本次减少二进位配置的临时对象与重复正文复制；同一桌面启动模型峰值约 38.14/48.37 MB（footprint/resident）。**实际 iPhone 50 MB 与断线修复仍待验收**。测试订阅地址不变，Version Date 更新为 `2026-11-15 16:20:21`。详见 [beta.2 说明](docs/releases/v3.2.4-beta.2.md)与[测量记录](docs/memory-beta2-2026-11-15.md)。main 保留 v3.2.3。

作者：Horatio / [hhhoratioxu](https://github.com/hhhoratioxu)。从原 [Proxy](https://github.com/hhhoratioxu/Proxy) 项目完整迁出的 Spotify 歌词补全与翻译插件，保留已有 **3.2.2** 核心、来源、匹配、时间轴、缓存和各客户端原生适配。

项目统一在 [hhhoratioxu/SpotifyLyrics](https://github.com/hhhoratioxu/SpotifyLyrics) 维护。完整项目已上传，5 个公开安装入口、18 个固定资源和新 Clone 均已核对，见 [GitHub 迁移校验](evidence/github-migration-verification.json)。首次仓库迁移保持原运行字节；后续 v3.2.3 更新了非中文翻译策略，Mac 无词补全、精确同步及 iPhone 整个代理扩展低于 50,000,000 字节的验收状态仍见下文。

**正式版历史：[v3.2.3 非中文歌词翻译修复](https://github.com/hhhoratioxu/SpotifyLyrics/releases/tag/v3.2.3)：中文原词保持，其他语言进入翻译；独立检查 626 项 Node / 18 项 Python、1011 项当前核心兼容与 2248 项历史基线通过。该正式版记录保留；本测试分支使用另一组经过核验的固定运行资源。** 详见 [多语言修复记录](docs/translation-2026-11-15.md)及[公开发布校验](evidence/release-v3.2.3.json)。

## 安装

| 客户端 | 订阅 / 导入文件 | 说明 |
| --- | --- | --- |
| Loon | [SpotifyLyrics.lpx](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/codex/spotify-memory-admission/Loon/script/SpotifyLyrics.lpx) | iPhone / iPad 默认 `mobile`；Mac 选择 `macOS` |
| Surge | [SpotifyLyrics.sgmodule](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/codex/spotify-memory-admission/Surge/script/SpotifyLyrics.sgmodule) | 保留 Surge 原生配置；iOS / macOS 未完成实机验收 |
| Egern | [SpotifyLyrics.yaml](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/codex/spotify-memory-admission/Egern/script/SpotifyLyrics.yaml) | 保留 ctx / Response 适配；当前设备显示效果未验收 |
| Quantumult X | [SpotifyLyrics.conf](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/codex/spotify-memory-admission/QuantumultX/script/SpotifyLyrics.conf) | 重写引用；原参数与限制保留 |
| Shadowrocket | [SpotifyLyrics.sgmodule](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/codex/spotify-memory-admission/Shadowrocket/script/SpotifyLyrics.sgmodule) | 原生模块；当前设备显示效果未验收 |

测试用户将现有 SpotifyLyrics 的订阅改用上表专用地址，保留原设置，并保持只启用一份 SpotifyLyrics。刷新 main 或旧 Proxy 地址不会取得这个测试版。正式版回退地址见 [测试版说明](docs/releases/v3.2.4-beta.2.md)。发布操作不会自动修改已安装插件或 VPN 设置。

Loon 的插件名称与编号功能描述保持现有 WeatherKit 风格。五个入口的运行脚本均固定到新仓库的完整 Git 提交，哈希见 [runtime-release.json](provenance/runtime-release.json)，不再向旧 Proxy 下载运行脚本。

## 当前功能与限制

- 原有补词、逐行同步、翻译目标、来源与缓存参数保留；Spotify 原生有词时按原逻辑处理，不在迁移时更换核心。
- Mac 原生英中双语已有可见实测记录；目标无词歌曲的歌词入口仍未通过，精确高亮、逐字、长期稳定仍需实机验证。
- iPhone 的 50 MB 是真实手机代理扩展的验收目标。Mac 进程与桌面 JavaScriptCore 测量无法代替 iPhone 峰值，当前尚未完成该验收。
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
