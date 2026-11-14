# Mac Loon 原生内存测量：2026-11-14

本轮直接采样这台 Mac 正在运行的 Loon VPN 扩展，并在 Loon 的 Script Records 中确认正式歌词脚本完成执行。它补充此前独立 JavaScriptCore 测量；两者不能互相替代。

**当前不能声称低于 50 MB。** Mac VPN 扩展的整个进程在关闭歌词插件的基线阶段已出现约 51.38 MB；开启手机版标准配置的采样阶段出现约 116.39 MB。其他插件、网络流量、配置加载和宿主分配没有被完全隔离，所以不能将差值归因于歌词脚本，也不能据此判定 iOS 超限。

## 环境与计量口径

- macOS 27.3；Loon 0.5.0 (1011)；Spotify 1.3.9.2055。
- Loon UI PID 1229；VPN 扩展 PID 1238；辅助进程 PID 574。PID 仅适用于这次记录。
- 使用系统自带 `/usr/bin/top` 的 `MEM`（physical footprint），分别采样三个进程；不把 UI 进程或 RSS 算成插件内存。`top -F -R` 避免遍历共享框架和完整虚拟内存区域。
- 本机内置 top 自带读取这些计数的权限。没有修改权限、SIP、证书或读取进程内容。直接对 root 扩展调用 `proc_pid_rusage` 被 EPERM 拒绝，没有把失败记作零内存。
- 限值严格使用 **50,000,000 bytes**，不是 50 MiB。`top` 的 `M` 使用 1024²；数字已取整，`+/-` 是变化标记。转换器保留一个显示单位的保守误差范围。
- 这是约每秒 11–12 次的**采样窗口最大值**，不是内核 lifetime peak。采样之间的短暂峰值仍可能遗漏。
- 音频测试前确认系统静音、输出音量 0，并将 Spotify 音量设为 0。测试后已下发暂停；最后 Spotify Connect 状态为 `NONE`，不能据此声称它确认了本地暂停。

计量定义核对于 2026-11-14：[Apple top 手册](https://github.com/apple-oss-distributions/top/blob/main/top.1)、[内存计数实现](https://github.com/apple-oss-distributions/top/blob/main/libtop.c)、[单位格式实现](https://github.com/apple-oss-distributions/top/blob/main/uinteger.c)。

## 实际采样结果

以下每行只列 VPN 扩展 PID 1238，UI 和辅助进程的独立数据见 [memory-summary.json](evidence/memory-summary.json)。

| 阶段 | 样本数 | 首末样本跨度 | top 最大显示 | 折算 MB（十进制） | 保守范围（bytes） |
| --- | ---: | ---: | --- | ---: | --- |
| 歌词插件关闭，其他原有插件仍运行 | 969 | 77.261 秒 | 49M+ | 51.38 | 50,331,648–52,428,800 |
| 手机版配置 / standard，含真实 Spotify 操作与配置加载 | 9,511 | 822.119 秒 | 111M+ | 116.39 | 115,343,360–117,440,512 |
| 后续临时 GENERIC 测试准备阶段，未执行压力夹具 | 9,727 | 826.857 秒 | 49M+ | 51.38 | 50,331,648–52,428,800 |

第一份原始记录 [live-memory.jsonl](evidence/live-memory.jsonl) 的文件创建时间为台北时间 08:43:45.878。111M+ 出现在开始后 167.899972 秒，约 08:46:33.778；临时压力桥的文件约 08:58 才开始创建，不能把早先的峰值归因于该压力桥。

阶段标签只标记采样期间的操作范围，**不是严格控制的 A/B 实验**。其他插件和流量未关闭，配置切换也会引入宿主分配。后续发现 MapKit 页面、名称和启用状态变化，暂停继续操作，以免改动另一个项目。峰值成因尚未确定，不能用这个差值证明旧的正常歌词代码存在缺陷。

第二份文件沿用准备时的文件名 [native-stress-memory.jsonl](evidence/native-stress-memory.jsonl)，但其中所有样本均为 `native-generic-baseline`：**没有成功执行原生压力测试，不得按文件名将其算作通过。**

本轮在原生 Loon Dashboard → Script Records 观察到正式插件的记录 1559：`VerseLyrics Lyrics`、RESPONSE、已完成、08:58:32.517、1.07 秒；同一正式插件还出现 Entry 完成记录。未打开原始请求、鉴权头或响应内容。这个观察能证明脚本在宿主执行，不能证明补词匹配、翻译或全部时间轴场景均通过。

## 压力测试工具的真实状态

准备了只使用自写歌词、合成元数据和独立 Map 存储的本地桥。运行文件来自 Git 固定版本，生成时检查原代码完整包含且语法有效；没有访问生产歌词缓存或账户凭据。源版本与哈希保存在 [source-manifest.json](evidence/source-manifest.json)。

- 手机版原运行文件：`10049053ce86bd992e3ebb6511ffb28312ba86fb`。
- Mac 产物：`795c677b0d115cab5eb8e4f959424d905a98e3ff`。
- 18 个夹具 × standard/compact × mobile/macOS = 72 项：冷/热缓存、600 行、多语种、JSON/protobuf、大正文、畸形数据、超时、超限翻译与大 Entry。
- **Node 测试桥校验：72/72 输出哈希与请求数符合基线。** [preflight-summary.json](evidence/preflight-summary.json) 与 [node-preflight-results.json](evidence/node-preflight-results.json) 明确标记 `Node-preflight`，不是 Loon 或内存验收。预期值来自同版本运行文件，测试用于验证桥是否改变行为，不是歌词匹配准确率的独立标准。
- **原生 Loon 压力夹具：未执行。** 普通终端探针没有命中临时 HTTP Script；尝试系统代理时 Loon 报告本地 HTTP/SOCKS 监听启动失败，已经关回系统代理。随后改为文档支持的手动 GENERIC，但没有找到可成功触发的 Mac UI 入口。没有伪造成功数据。
- 没有生成 `native-fixture-results.json`。服务只接受合成结果的固定字段，Node 与 Loon 分开保存；额外夹具传输本身会有开销，即使以后原生运行成功也需另列。

使用的 Loon 能力于 2026-11-14 核对：[Script](https://nsloon.app/docs/Script/script_v2/) 的 GENERIC 与 timeout、[Script API](https://nsloon.app/docs/Script/script_api/) 的毫秒 HTTP timeout、二进制回调和 `$done({title,content})`。未发明脚本运行 Scheme、取消 API 或内存统计字段。

## 本地复现

2026-11-14 独立迁移补充：`preflight.mjs` 是依赖回环 HTTP 服务的旧工具，不能作为无服务的离线检查。迁移初次将其用于独立性检查时，由于服务未启动，完成数为 0，检查失败；保留记录在根目录 `evidence/independence-network-preflight-failure.json`。没有启动监听、改网络配置或运行 Loon 压力夹具。

新增 `preflight-offline.mjs` 以进程内夹具传输执行原生成测试桥，不调用 fetch、不创建监听，不访问生产存储。先运行 `prepare.mjs` 再运行该脚本，72 个输出哈希和请求数与基准符合。其结果为 Node VM 桥验证，仍不是 Loon 内存验收。根目录 `npm run check:independent` 会在父仓库之外重新生成夹具并执行此离线步骤。

单位与误差转换检查：

```sh
python3 -m unittest discover -s Loon/Development/SpotifyNativeMemory20261114 -p '*_test.py'
```

先用 `ps` 确认当前真实 Loon PID，再在本目录执行只读采样。`--seconds` 上限 900 秒，采样器只接受命令名包含 Loon 的 PID。相位文件仅含 `{"phase":"自定阶段"}`；创建 stop 文件即可提前结束。不要同时操作其他插件或把旧 PID 复用于另一个进程。

```sh
python3 monitor.py --pid <VPN扩展PID> --pid <UI进程PID> \
  --seconds 180 --phase /tmp/verselyrics-native-memory-phase.json \
  --stop /tmp/verselyrics-native-memory-stop --output evidence/new-run.jsonl
```

`prepare.mjs` 生成的 `runtime/` 已忽略，不会改正式订阅。`serve.py` 仅绑定 127.0.0.1:18766；启动后可用 Node 执行 `preflight.mjs` 验证测试桥。**导入和启用临时测试插件本身不会自动执行 GENERIC。原生触发途径没有验证，不提供声称可用的操作步骤。**

## 收尾与尚未完成的验证

- 采样进程均已停止；本轮启动的回环服务和 Loon Dashboard 已关闭。没有重启 Loon/VPN，没有清理 Spotify 或歌词缓存，没有改生产脚本，没有 Push。
- 系统代理的最后只读检查与初始状态一致：HTTP、HTTPS、SOCKS 均未启用；仅显示 `FTPPassive: 1`。
- 正式歌词插件最后成功观察为 mobile / standard / 关闭（测试前也是关闭）。临时「VerseLyrics 原生内存测试（临时）」最后成功观察为启用，仅含两个手动 GENERIC，无 HTTP 拦截或 MITM。
- **临时插件还未在 UI 中停用。** 收尾的界面读取连续超时，包括全局应用清单；关闭本轮 Dashboard 后仍失败，因此未继续盲点或重启 VPN。回环服务已停止，该手动插件不会自动处理流量。下次 UI 可用时只停用该精确名称的临时插件，保留 MapKit 等其他设置。
- 本轮未完成受控的 mobile/compact 与 Mac 平台对照，也没有 iOS VPN 扩展的设备采样或 Jetsam 证据。**iOS 严格低于 50 MB 仍未验收；此前独立 JSC 的约 12 MB 不能替代此项。**
- 下一轮先解决可重复的原生触发与无并发操作窗口，再归因和优化；在没有证据前保留用户确认正常的 3.2.2 行为。
