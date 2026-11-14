# 来源、署名与许可证

项目作者：Horatio（GitHub：hhhoratioxu）。当前用户可见名称为 SpotifyLyrics，维护核心保留 3.2.2。

- 稳定源码恢复自 `hhhoratioxu/Proxy` 提交 `10049053ce86bd992e3ebb6511ffb28312ba86fb` 的 `Surge/Development/VerseLyrics322/`。`provenance/recovery-manifest.json` 记录 125 个原始文件；`history/3.2.2/` 保留原字节和既有署名。
- Mac 构建来源提交为 `9f7399dda1279689d2436e981a547b1ea45513b3`；公开 Mac 运行对象固定在 `795c677b0d115cab5eb8e4f959424d905a98e3ff`。`provenance/snapshots.json` 与内容对象保存迁移所需原件，无须读取父仓库 Git。
- `archive/` 保留早期 Egern 实现及隔离恢复实验；它们不代表当前默认运行实现，也不作为新的设备验收结果。
- Unicode 数据的 License V3 见 `src/NOTICE-UNICODE.txt`，应随使用该数据的产物保留。
- 构建依赖使用锁文件，Terser 5.51.2 为 BSD-2-Clause；其依赖包含 MIT/BSD 许可的软件。依赖包各自的许可证继续适用，不把构建工具许可套用于整个项目。

目前未确认项目整体采用哪一种再分发许可证；此文件不自行授予 MIT、Apache 或其他新许可。正式公开源码前须明确这一点；已建立的 GitHub 仓库保持空仓库。源码许可证与歌词数据/API 的访问和展示授权分别核对，不能因接口可访问就认定获得歌词再分发许可。

`x-verselyrics-internal`、`x-verselyrics` 与 `VerseLyrics.v1.cache` 是兼容性身份；历史名称仍用于来源说明，不做全局替换。迁移不携带用户 Spotify 登录凭据，也不抓取本机账户文件。
