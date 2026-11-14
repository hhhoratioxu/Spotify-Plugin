# 正式 Mac 配置实测 A：2026-11-14

**结果：有词歌曲双语显示及播放进度跳转取得新实测证据；《那页夏天》无词入口 / 补词仍未通过。** 已恢复正式插件为关闭 / mobile / standard，并核实 Loon Connected。没有更新订阅或脚本，没有导入额外诊断，没有 Push。

本轮只执行用户明确许可的 A，待 WeatherKit 明确释放界面后开始。既有手机版 3.2.2、匹配规则、来源和其余参数未改。诊断 B 仍未获许可，未运行。

## 固定版本与操作

- Spotify macOS 1.3.9.2055；Loon for Mac 0.5.0 (1011)。正式入口为 `Loon/script/SpotifyLyrics.lpx`，配置日期 2026-11-14。
- UI 中三份 Mac 运行引用仍固定到 `795c677b0d115cab5eb8e4f959424d905a98e3ff`；没有点击插件更新。
- 初始只读值：正式插件关闭、CLIENT_PLATFORM=mobile、MEMORY_MODE=standard。
- 临时操作仅为 CLIENT_PLATFORM=macOS、正式插件开启。其余 12 个原参数保持，测试后逐项复核。
- 系统输出为 MacBook Pro Speakers，音量 0、静音开启；Spotify Connect 确认这台 Mac 音量 0。播放命令只定向当前 Mac。结束确认 PAUSED、音量 0。
- Spotify 辅助功能树未返回 Web 内容，所以显示与按钮由实际画面检查；曲目身份、目标设备、音量和跳转进度另由 Spotify Connect 验证。没有把图像观察写成逐行数量或精确时序测量。

## 关键验收

| 场景 | 观察 | 结论与限制 |
| --- | --- | --- |
| 初始原生有词对照 | 插件关闭时，现有《Sweet Child O' Mine》歌词视图仍显示英文；播放处于暂停。 | 仅证明现有视图可用，未区分缓存和新原生响应。 |
| 《Take on Me》原词和双语 | 核对 a-ha 的既有测试 URI后，定向 Mac 零音量播放；原生歌词视图出现英文与中文译文。 | 本版本、该曲的显示样本通过；没有统计全部行数或核对每句译文质量。 |
| 前进至 90 秒 | 暂停后发出 90000 ms 跳转；Connect 返回 PAUSED / 90000，UI 底栏显示 1:30，双语仍可见。 | 播放进度跳转及视图保留有证据。 |
| 后退至 10 秒 | Connect 返回 PAUSED / 10000，UI 底栏显示 0:10，双语仍可见。 | 暂停状态下视口没有明显回到第一行；不据此验收自动滚动或逐毫秒高亮误差。 |
| 《那页夏天》补词 | 核对王俊凱、公开测试 URI；Connect 确认 Mac 播放，音量 0。画面只显示封面；回到常规播放器，歌词图标灰色，点击未打开歌词或显示补全。 | **未通过。** 不能以正常播放、Entry 已完成或离线补词成功替代此结果。 |
| 异常网络 / 多语种 / 来源组合 / 逐字 | 本轮未扩大测试或修改网络条件。 | 未测；此前离线结果与此次实测分开。 |

两首定向播放曲目均经 Spotify 工具确认可播放。本轮没有清除 Spotify、下载或歌词缓存，也没有绕过账户或播放权限。

## 必要的原生执行记录

只读查看 Loon Dashboard 的 Script Records，未打开原始请求详情、授权头或原始响应。表中显示正式插件 ID `04789db44daaaf7debedc53525cacff2`：

| 记录 | 时间 | 脚本 | 方法 / 类别 | 完成耗时 |
| --- | --- | --- | --- | --- |
| 1660 | 11:37:54.200 | VerseLyrics Mac Request | GET / color-lyrics | 5 ms |
| 1663 | 11:37:56.784 | VerseLyrics Lyrics | GET / color-lyrics | 3.66 s |
| 1665 | 11:39:43.568 | VerseLyrics Mac Request | PUT / connect-state | 3 ms |
| 1666 | 11:39:43.771 | VerseLyrics Entry | PUT / connect-state | 9 ms |
| 1679–1681 | 11:40:57.153–155 | VerseLyrics Entry | POST / extended-metadata | 2–4 ms |

可见连续记录范围 1659–1682 中，在切换无词目标之后没有出现新的 VerseLyrics Lyrics 执行；随后只有 Request / Entry 等记录。**可证故障点是：无词入口仍不可用，未在该记录窗口触发可见的歌词响应脚本。** 这不是完整 HTTP 抓包，不能断言客户端从未发送请求，也不能确定目标曲目包含在哪个 Entry 正文中。

3.66 秒为原生脚本记录的处理耗时，不是歌词首次绘制耗时。接口类别经过归类，没有保存原始 URL、账号/设备标识或歌词正文。去敏观察见 [observations.json](evidence/native-a-20261114T113224/observations.json)。

## Mac 只读内存采样

在本次操作期间只读采样相同 VPN 扩展 PID 1238、UI PID 1229 和辅助进程 PID 574，共 600.139 秒、20,448 个进程样本，其中 VPN 扩展 6,816 个样本。

- VPN 扩展窗口最大显示为 **59M+**，折算约 **61.87 MB**；保守显示误差范围为 **60,817,408–62,914,560 bytes**。
- `mac-a-pre-enable` 是切换前后的过渡标签，并不代表完整的稳定关闭基线；其他插件和后台流量继续运行，不能做插件独占内存或受控 A/B 归因。
- 这是整个 Mac 进程的采样最大值，不是内核 lifetime peak。与早先 116.39 MB 的不同不能算作优化收益，本轮生产代码完全未改。
- 采样在 10 分钟上限到达时自行结束，未覆盖之后的全部 UI 收尾；恢复状态由 UI 单独核实。
- **Mac 无 50 MB 产品上限；iOS 严格低于 50,000,000 bytes 仍未验收。** 本轮没有运行原生压力夹具。

方法、分组、原始数值与文件哈希见 [memory-summary.json](evidence/native-a-20261114T113224/memory-summary.json) 及同目录原始 JSONL。

## 收尾及最小下一步

已在 Loon 界面核实正式插件关闭、平台 mobile、缓存 standard 和其余原参数；VPN 显示 Connected。扩展 PID 1238 的启动时间仍为 2026-11-12 23:27:51，本轮没有关闭或重启 VPN。系统代理只读结果仍仅有 `FTPPassive: 1`；未操作节点、系统代理、全局 MITM、证书、其他插件。既有 Dashboard 未关闭，界面已释放。Spotify 最后确认暂停在无词目标约 1:56，音量 0。

下一步最小取证为 [CONTINUATION.md](CONTINUATION.md) 中已准备的 B：对现有 ConnectState / TRACK_V4 做有界前后配对，确认公开目标是否在响应内及其歌词标记是否实际改变，再决定修复位置。**需要另获明确许可才可导入或启用 B；A 的许可不覆盖它。** 当前证据不支持放宽匹配、猜测桌面 feature flag，或把故障归为来源不收录 / 缓存已坏。

无词补全、精确同步、逐字、长期稳定和 iOS 内存目标未完成验收，发布状态继续为未就绪。
