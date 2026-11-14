# SpotifyLyrics

作者：Horatio / [hhhoratioxu](https://github.com/hhhoratioxu)。这是从真实 Proxy 项目复制恢复的独立本地维护项目，核心 **3.2.2**，保留旧版架构、来源、匹配、翻译、缓存与原生客户端差异。

**本轮未上传源码、未切换正式订阅；Mac 修复验证包已临时实测并撤回。** Mac 原生无词入口仍未通过；精确同步、逐字、长期稳定及 iOS 整个代理扩展严格低于 50,000,000 字节仍需验收。拆仓不会改变这些结论。

- `src/`：从稳定历史复制的当前维护源码。没有使用 `archive/SpotifyLyricsPlus/src` 的隔离实验核心。
- `history/3.2.2/`：125 个原始历史文件，按恢复清单保持字节一致。
- `Loon/`、`Surge/`、`Egern/`、`QuantumultX/`、`Shadowrocket/`：各客户端原生 `script/` 入口、运行脚本和文档。
- `Loon/Development/`：Mac 适配、订阅构建、内存工具与已有实测记录；临时诊断不会自动安装或启用。
- `provenance/`：原 Git 源对象的本地校验快照、未改名前入口、来源与迁移记录。
- `archive/`：历史 Egern 与恢复实验的复制档案，不能用其结果代替当前实现验收。
- `.migration-backup/`：本机完整原件备份，含构建依赖及其符号链接；不进入新 Git 仓库或发布。

独立构建和离线验证：

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run test:baseline
npm run check:independent
```

构建只使用本目录源码、锁定依赖和经过 SHA-256 核验的来源快照，不执行父仓库 `git show`。当前入口继续引用原 Proxy 的完整提交 URL，保证迁移阶段不提前切换资源。显示名改为 SpotifyLyrics，版本号、内部请求标记、缓存键和原参数保持。

现有用户继续使用原订阅：[Loon 原入口](https://raw.githubusercontent.com/hhhoratioxu/Proxy/main/Loon/script/SpotifyLyrics.lpx)。这个链接没有由迁移修改。新独立 GitHub 仓库为 [hhhoratioxu/SpotifyLyrics](https://github.com/hhhoratioxu/SpotifyLyrics)，公开；已只创建空仓库并配置本地 origin，API 核实 isEmpty=true，没有提交、Push 或发布源码。必须先完成验收，再处理源码发布和订阅切换。

详见 [迁移与兼容记录](docs/migration.md)、[验收状态](docs/acceptance.md)、[许可证与来源](NOTICE.md)、[Loon 官方文档适配记录](Loon/Docs/OfficialReference.md)。

最新[Mac B 实测](Loon/Development/SpotifyMac20261114/NATIVE-B.md)：有词对照曲可打开歌词页，《那页夏天》的 Show lyrics 仍不可用；22 条五字段记录全部 unknown，不能确定根因。约 131 秒采样中整个 Mac VPN 扩展最大显示 53M+，约 55.57 MB，包含其他插件及诊断开销，不是 iOS 或插件独占内存。临时项已撤，配置、原脚本及共享歌词缓存已核对；两个宿主 MMKV 索引字节差异保留并记录。播放已暂停、音量恢复，UI / Loon 已释放。

[严格五字段 B 产物与边界](Loon/Development/SpotifyMac20261114/strict/README.md)及[纯离线 B 预检](Loon/Development/SpotifyMac20261114/strict/OFFLINE-PREFLIGHT.md)继续保留。新增 JSON / previewLines 修复候选保持隔离，不自动安装。

18:12 阶段先离线修复了[诊断输入兼容](Loon/Development/SpotifyMac20261114/strict/INPUT-COMPATIBILITY.md)，当时 131 项 Node / 5 项 Python 通过：支持有界 ArrayBuffer、跨 realm / offset view 和严格 UTF-8 的已知 JSON。后来该版本已于 23:04 实测并撤回。当前严格诊断增加精确公开请求的本地比较，150/6 预检通过；五字段及类型、生产核心、规则和参数保持，不能用这些检查改写实机失败或手机内存结论。

后续完整结果见 [macOS / iPhone 修复进展](docs/repair-2026-11-14.md)：385 项 Node、18 项 Python、2248 项历史基线通过；Mac 双语已再次实测，无词目标仍失败，临时配置已恢复。新增共享储存的桌面 JSC 并发筛查最高约 33.36 MB footprint / 44.19 MB resident，独立储存极端模型则未通过双指标参考线；这些均不能代替 iPhone 设备峰值。用户目前无法设置「iPhone 镜像」，手机原生验收暂缺设备连接。
