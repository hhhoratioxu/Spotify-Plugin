# Spotify Lyrics+ · 歌词补全维护主线

作者：**Horatio** · GitHub：[`hhhoratioxu`](https://github.com/hhhoratioxu)。接手和恢复日期：**2026-11-13**。

**维护基准：继续使用用户确认正常工作的旧版及现有正式入口。** 本次恢复和离线审查不表示旧版不可用。后续先复现具体问题，再在保留旧版功能和配置的基础上做最小修改。

本项目从现存的 **VerseLyrics 3.2.2** 真实源码恢复，保留共享核心、客户端适配层、原生入口、JSON/Protobuf 编解码和构建方式。原先名为 `SpotifyLyricsPlus/`、`SpotifyLyricsPlus.js`、`SpotifyLyricsPlus.plugin` 的最早代码尚未定位，不能据此否定此前开发，也不能把命名关联当成已证明的 Git 谱系。

**`src/` 和 `dist/` 是另外建立的隔离实验候选，尚未发布，也未替换 Proxy main 的任何正式入口。来源关闭仅适用于这个实验候选，现有旧版没有被停用或修改。** 来源授权核查仍单独记录在 `source-policy.json`；不能把实验候选的限制描述为旧版不能正常使用。

## 真实代码与历史

- [恢复清单](recovery-manifest.json)：125 个文件的原始路径、Git blob、SHA-256 和恢复提交。
- [历史基线](history/3.2.2/README.md)：从 [`10049053ce86bd992e3ebb6511ffb28312ba86fb`](https://github.com/hhhoratioxu/Proxy/tree/10049053ce86bd992e3ebb6511ffb28312ba86fb/Surge/Development/VerseLyrics322) 恢复，历史文件逐字节保留。
- 隔离实验候选：[共享核心](src/spotify-lyrics.js)、[原生适配器](src/native-adapter.js)、[构建器](build.mjs)。这些文件基于旧实现修改，不能自动作为稳定版替代。
- [真实实现状态与遗留问题](docs/implementation-status.md)、[安装与兼容性](docs/client-compatibility.md)、[测试与验收](docs/testing.md)。

历史基线 2248 项测试已在本机重新构建并通过。候选测试结果单独记录在 [`evidence/validation-summary.json`](evidence/validation-summary.json)，不把基线通过数量算成候选已通过数量。两者均为自动化证据，尚未完成真实 Spotify 客户端、iPhone、长时间 VPN 或耗电验收。工作区存在并行分流审计改动，本轮写入范围仅为本目录及临时构建文件；外部快照差异保留，见 [`evidence/workspace-integrity.json`](evidence/workspace-integrity.json)。

## 本地候选的行为

1. Spotify 有可用歌词时原样返回，包括静态歌词、原生译文、时间轴、逐字字段和未知数据；不主动翻译或升级原生静态歌词。
2. 只有真正的 404 或已识别的空歌词结构才能进入补词。401、403、429、5xx、权限提示、未知或损坏格式保持原响应。
3. 来源先通过构建时的授权清单，再按完整曲名、艺人、专辑、时长和版本信息匹配。多个不一致候选不按搜索顺序选中；不猜测日文/韩文转写或英文译名。
4. 歌词缓存同时核对来源、匹配修订、原先核实的元数据和真实时间轴。旧版缓存保留在原存储命名空间，候选不读取其中未经过新校验的歌词。
5. 可信成功歌词 TTL 为 30 天；缓存容量仍会使较早或较大的记录提前淘汰。默认 compact 为 64 条 / 32000 字符，standard 为 128 条 / 64000 字符。元数据、来源失败与限流使用各自较短有效期。
6. 网易云和 QQ 搜索上限 10 条；通用候选匹配只考察前 10 条。每次最多 12 次来源请求、来源累计 256 KiB；顺序请求，不增加后台轮询或重试队列。
7. 补充歌词只采用真实逐行时间戳。原生已有逐字数据完整保留；来源 LRC 的行内标记不会被伪造成 Spotify 逐字格式。
8. 读取当前歌曲拦截元数据或无凭据的公开嵌入页。不读取或转发 Spotify 私人 Token、登录 Cookie 或 client-token。

## 构建和测试

需要 Node.js 22 或更新版本、npm，以及用于历史基线打包的 Python 3。依赖锁定，项目不需要 Spotify 登录或 API Key。

```sh
cd /Users/hhhoratioxu/Documents/CodeX/Proxy/SpotifyLyricsPlus
npm ci --ignore-scripts
npm test
npm run test:baseline
```

`npm test` 会生成并检查当前 `dist/`，另外生成仅供离线模拟的 `test-runtime/`，执行当前候选测试，并将九组继承的编解码、缓存及元数据回归用于当前源码。继承测试的缓存键与 10 条搜索上限夹具会在临时目录适配；历史文件不变。`npm run test:baseline` 在独立临时目录构建原始版本并执行完整历史测试。

只构建候选：

```sh
npm run build
```

实际生成的导入文件为 `dist/Loon/script/SpotifyLyrics.lpx` 和 `dist/Surge/script/SpotifyLyrics.sgmodule`，脚本及 SHA-256 清单在同一个 `dist/` 下。默认引用本机 `http://127.0.0.1:8765/`，用于本地复核；iPhone 需要可达的 Mac 局域网地址，详见[安装说明](docs/client-compatibility.md)。这些 URL 不代表 GitHub 已存在候选版本。

当前授权清单为空，因此安装候选也不会在线补词。不要通过修改安装参数将测试构建当作已获授权的公开版。后续先补齐具体来源的调用及展示依据，再核对该来源当时的接口规范、更新授权清单、执行回归和实机验收；Push 与发布仍需用户确认。

## 后续工作顺序

- 核实最早 `Script_By_Horatio` / `SpotifyLyricsPlus` 原稿与历史备份，继续补充来源链证据。
- 核实歌词来源的授权范围、署名及缓存要求；授权有效期可能要求缩短 30 天 TTL。
- 先完成 Loon 的真实无词入口、逐行同步、快进/后退及连续切歌验收，再验证 Surge iOS/macOS。
- 取得具体无词歌曲及失败响应的脱敏证据，重现来源覆盖和版本混淆；保留无法匹配的拒绝结果。
- Egern、Quantumult X、Shadowrocket 保留已恢复代码和模拟回归，分别核对其原生二进制 API、空响应拦截条件和设备行为后再决定发布支持。
