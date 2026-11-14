# Spotify Mac 补词诊断续接：2026-11-14

**结论：尚未定位《那页夏天》补词失败的最终根因，未通过完整验收，本轮没有 Push。** 已修复一处可证的诊断缺陷，准备了固定版本的诊断文件，并保留手机正常的 3.2.2 核心及已发布 Mac 核心。

原始实测记录仍为 [verification.json](evidence/verification.json)；不要改写该历史文件，把新的自动测试或只读观察当作当时已通过。[原生内存报告](../SpotifyNativeMemory20261114/README.md)的范围也保持不变。

后续已按最小许可完成[正式配置实测 A](NATIVE-A.md)：有词双语与播放进度跳转取得新证据，无词目标仍未通过；已恢复关闭/mobile/standard 并核实 VPN Connected。下文离线排查与早期只读观察为该次原生实测之前的记录。B 仍未获许可，未运行。

## 当前真实证据

| 项目 | 证据与结论 |
| --- | --- |
| 手机原行为 | 用户确认旧版正常；本轮未改核心，也未做新的 iPhone 功能或内存实测。 |
| Mac 逐行双语及跳转 | 之前《Take on Me》有双语显示和 90 秒 / 10 秒跳转观察；不是本轮新验收，也不是完整场景矩阵。 |
| Mac 完全无词补全 | 之前《那页夏天》失败；ConnectState 交回修改字节后，歌词按钮仍禁用。不能据此认定第三方无收录或缓存为根因。 |
| 本轮只读 Loon 观察 | Loon Connected；正式订阅关闭，CLIENT_PLATFORM=mobile，MEMORY_MODE=standard。其余参数见下节。没有改变网络配置或播放音乐。 |
| 当前重测前置条件 | 正式插件关闭，因此当前配置不能验收 Mac 适配。这个现状不解释之前启用测试插件时的失败。 |
| 桌面客户端静态核对 | 已安装程序的歌词按钮在 isEnabled=false 时禁用且没有切换回调；上游有 data.hasLyrics 和 track URI hook 的 hasLyrics 两种输入。尚未把这些 hook 追溯到捕获的 HTTPS 响应。 |
| iOS 50 MB | 未验收。Mac 进程采样 51.38 / 116.39 MB 混有其他开销，不能归因插件或推断 iOS。 |
| 原生压力测试 | 未执行。72 项 Node 桥校验不是 Loon 压力测试；没有 native-fixture-results。 |
| 逐字、长期稳定、Surge Mac | 仍未验收。 |

桌面静态事实及程序哈希见 [desktop-client-facts.json](evidence/desktop-client-facts.json)，可通过 `python3 inspect-desktop.py` 重新读取安装程序。工具只输出字段事实、偏移、哈希和判定，不执行客户端代码、不访问用户配置、不复制程序或完整代码包。

特别注意：`spotify.cosmos_util.proto.TrackMetadata.has_lyrics` 是字段 **13**；`spotify.metadata.Track.has_lyrics` 是字段 **18**；ConnectState 的曲目 metadata 又是字符串映射。不能把一个格式的字段号套到另一个格式，也不能因改写了 ConnectState 就推断桌面按钮已经取得新值。尚无证据允许修改新的接口或 feature flag。

## 本轮确认并修复的诊断缺陷

旧版 `debug-wrap.mjs` 的所有事件均为 `route=runtime`。完成事件只记录返回字节数，没有改写后的可用性字段；输入中的曲目 URI 也只表示某首歌曲，无法归到公开测试曲目。这使已有日志无法回答：哪个接口被处理、测试曲目位于当前项还是队列、改写后字段是什么。

本轮只改本地诊断工具：

- `diagnostic-route.mjs` 将已知 Spotify URL 归为固定类别；不输出 URL、查询参数、账号或设备标识。未知域名、未知方法和过长 URL 只记为 other。
- `debug-wrap.mjs` 让输入和完成事件共用临时随机 run 标记，两个事件均记录有界结构。未知 MIME 只记类别，不输出任意头部内容。
- `protocol-shape.mjs` 与 `metadata-shape.mjs` 可额外记录公开测试 URI 是否出现在相应字段，仅输出布尔值和路径。它表示响应中出现该曲目；队列中的出现不能算当前播放曲目。
- JSON 未做字段检查时明确记为 not-performed，不把它当作 protobuf 无标记或解析成功。
- 日志继续只发往 127.0.0.1，单条小于 4 KiB，最多 400 条驻留内存；HTTP timeout 仍为 300 ms，重复回调和服务失败后只完成一次。

独立回归用自写二进制响应运行实际固定的 Mac Entry：验证同一公开测试曲目输入 false、输出 true 的配对记录；也覆盖原本 true 时无修改、JSON 检查未知及敏感测试文本不进入日志。**它验证诊断是否有效，不代表真实客户端补词成功。**

等待 UI 窗口期间另补 `missing-lyrics.test.mjs` 的 11 项目标曲目响应链检查：使用存档公开 Spotify 元数据和自写歌词，实际 Mac 固定产物在 QQ / 网易有效候选下能把 404 转为 200 JSON 同步歌词，时间为 1000 / 3250 ms；冷元数据与热歌词缓存通过，错歌手、Live、Remix、时长不符、非法 QQ 标识及来源失败不注入，已有中文同步歌词保持原样。外部来源不收到测试 Authorization/Cookie。最初 QQ 夹具使用非法下划线标识，被正常核心拒绝；修正测试数据并保留拒绝用例，没有放宽生产规则。**这排查的是请求已到达后的响应链，不证明真实 QQ/网易服务当前可用或 Mac 无词入口可达。**

## 固定版本与验证结果

- 手机运行对象：`10049053ce86bd992e3ebb6511ffb28312ba86fb`。
- Mac 运行对象：`795c677b0d115cab5eb8e4f959424d905a98e3ff`。
- 本地正式导入文件对应已有订阅构建；没有更新应用中的订阅或运行脚本。
- 新诊断产物和底层运行文件的 SHA-256、字节数见 [diagnosis-artifacts.json](evidence/diagnosis-artifacts.json)。生成器检查底层固定运行代码完整保留，诊断不进入正式订阅。
- Mac 回归 **99/99 通过**，见 [diagnostic-regression-tests.tap](evidence/diagnostic-regression-tests.tap)；包含原 73 项、新诊断 15 项和目标曲目响应链 11 项。
- 正式订阅分流与固定运行对象检查 **12/12 通过**。本地服务精确路径、版本文件字节与路径拒绝检查 **3/3 通过**，后者直接调用 Handler，未打开监听端口。
- 正式订阅、三份已发布 Mac 脚本和五份既有本地原核心/运行文件共 **9 个哈希不变**，见 [pre-diagnosis-production-hashes.json](evidence/pre-diagnosis-production-hashes.json)。恢复的 125 份历史文件另按恢复清单核对。
- 上述均为离线检查。本轮没有 Loon 原生诊断执行或新的 Spotify 播放验收。

本目录本地复现：

```sh
node build-mac.mjs
node build-diagnosis.mjs
node --test *.test.mjs
python3 -m unittest discover -p '*_test.py'
python3 inspect-desktop.py
```

安装依赖按原 README 的锁定版本执行。**这些命令只构建和离线检查，不会导入或启用插件；本轮没有启动 serve.py。**

## 原生实测授权与操作范围

本轮要求所有 Spotify 网络插件配置变更另行确认。主聊天转达用户对下面最小方案 A 回复「允许」，随后明确通知 WeatherKit 已释放 UI。**A 已按该范围执行并恢复，结果见 NATIVE-A.md；B 未获许可。** A 的许可明确不覆盖扩大变更或更新脚本，之前 MapKit / WeatherKit 的确认也不覆盖 B 或其他 Spotify 操作。

### A：最小正式配置重现

精确资源：`https://raw.githubusercontent.com/hhhoratioxu/Proxy/main/Loon/script/SpotifyLyrics.lpx`，应用显示 ID `04789db44daaaf7debedc53525cacff2`、配置 2026.11.14。

| 设置 | 当前只读值 | 拟临时值 | 测试后恢复 |
| --- | --- | --- | --- |
| 正式 Spotify 插件开关 | 关闭 | 开启 | 关闭 |
| CLIENT_PLATFORM | mobile | macOS | mobile |
| MEMORY_MODE | standard | standard | standard |
| 订阅 / 脚本更新 | 未执行 | 不点击更新，使用现有固定 795c677… 运行链 | 不变 |

其余已读参数均保持：NETWORK_MODE=online、FALLBACK_MODE=synced、FALLBACK_OFFSET_MS=0、FETCH_ARTWORK_COLOR=true、PREFERRED_SOURCE=auto、TRANSLATION_ENABLED=true、SOURCE_TRANSLATIONS=true、TARGET_LANGUAGE=zh-CN、FALLBACK_PROVIDER=auto、DISCOVER_MISSING=true、REPLACE_UNSYNCED=true。

需要约 10 分钟独占窗口。先读当前静音状态；系统输出与 Spotify 音量不是零时先停止播放操作。只在当前 Mac 以零音量测试《那页夏天》和有词对照，记录歌词按钮、实际歌词请求、显示、快进后退与错误回退。无论结果如何，恢复表中值。只读采样独立列出整个 Mac VPN 进程，不能标为 iOS 50 MB 验收。

### B：A 仍失败时的可选配对诊断

只有单独确认同时涵盖 B 时才执行；A 的许可不自动覆盖 B。

- 当前未安装该文件。拟启动只绑定 127.0.0.1:18765 的本地服务，临时导入并启用 [DiagnosisMac.lpx](DiagnosisMac.lpx)，名称「Spotify Mac 无词入口诊断（临时）」。SHA-256 为 `2482841b803db9b70b99f8f9eedd8dd5679419e19892358144c61010c4fb4c6b`。
- 仅在正式 Spotify 插件关闭时启用它；五个旧 Mac 诊断插件继续关闭。三个脚本的文件名含内容哈希，避免把旧脚本缓存误认新诊断；源运行链与 A 的固定 Mac 文件一致。新插件使用与 A 相同的原有 12 个参数值。
- 用相同歌曲序列收集前后配对结构，约 10 分钟；原生请求详情与授权头不打开、不导出。诊断增加两次本机 POST 和至多两个 300 ms 超时，不用于无诊断性能验收。
- 结束后关闭并移除本次新增的精确名称插件、停止本地服务、恢复正式插件为关闭/mobile。保留本地代码和去敏证据。
- 全程不关闭或重启 Loon/VPN，不动节点、系统代理、证书、全局 MITM 或其他插件；只沿用 Spotify 文件原有的两个 spclient 域名。历史「VerseLyrics 原生内存测试（临时）」仍保持原状，不运行、不趁机清理。
- 不清 Spotify 缓存、下载或歌词缓存；不改匹配阈值、歌词来源授权或播放权限。

## 发布门槛

先取得真实无词入口 → 歌词请求 → 身份匹配歌词 → 原生显示的完整链路，再判断需修改哪一层。失败路径要保留原响应，有词对照不得受损。之后补足中文/英文/日文/韩文、版本混淆、纯音乐、来源失败、缓存与连续使用等实际验收。

手机版严格低于 50,000,000 bytes 必须单独取得 iOS 扩展的有边界设备测量和峰值证据。Mac、独立 JSC、Node VM 或未发生 Jetsam 都不能替代。逐字功能只保留真实时间轴，未取得场景不写成通过。

关键使用链路和内存目标未验收前，本轮修改不 Push。报告与诊断代码已准备随最终获准的修复一起纳入 GitHub；此刻不宣布三个项目或 Spotify 已完全正常。
