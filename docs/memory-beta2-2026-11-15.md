# beta.2 启动配置内存优化

用户反馈 v3.2.4-beta.1 仍会在 iPhone 打开 Spotify、开始播放时使 Loon VPN 断开，并要求继续更新优化。此次延续同一个测试分支，不更换 main 正式版。手机错误文本、具体设备/系统版本和退出报告仍未取得，不能认定下面的合成场景就是实际断线的唯一根因。

## 确认并减少的分配

原启动配置处理为每个 assigned value、identifier 和值建立字段对象/数组，再筛选歌词设置。一份接近 128 KiB、包含大量无关设置的配置，会为不需要改写的字段产生大量临时对象。新的实现先验证配置头，再扫描指定 namespace/property；无关值保持原始字节，只有真正要修改的目标才建立小型字段视图。

重写时根据已验证的字段范围构造一个配置输出缓冲；不会先把全部字段树重建。Bootstrap/Customize 包装层也各使用一个输出缓冲，省去原先 dataField 和 replaceField 对整段正文的重复复制。目标已开启或响应不支持时保留原输出，未知字段、字段顺序、状态、语言与时间轴行为不改。

这次只改变五个客户端 Entry 包的配置处理。歌词正文处理包、歌词搜索与翻译包、Mac 已有 Entry/Request 包的字节保持 beta.1 的内容；新版原生导入文件仍统一引用经过哈希核验的新完整提交。核心协议/缓存身份继续是 3.2.2。

## Loon 原生条件

手机入口在无词发现关闭或备用来源关闭时，不再启动 Entry Body Script；翻译和补词同时关闭时，不再启动歌词 Body Script；已有处理标记的响应也不再进入第二次处理。这些条件对应原核心已有的放行分支，没有修改开关默认值，没有要求用户关闭功能来换取内存降低。

beta.1 的 JSON 透传筛选保留。Mac 原生条件与最低版本保持；没有新增宿主 API、取消接口、定时器、后台任务、内存参数或依赖。

## 保真与回归

64 项配置比对检查覆盖原始工作核心、Customize/Bootstrap、开启/关闭/缺少目标、错误类型、多个目标、重复字段、1–3000 个配置项，以及 Loon/Surge/Shadowrocket/Quantumult X 的同步完成和 Egern 原生异步入口。另有 700 个固定随机异常样本逐一比较原决策、错误及输出字节。新增 5 项 Loon 配置选择检查验证关闭功能及已处理响应不启动正文脚本。

完整独立验证通过：747 项 Node、18 项 Python、1011 项当前核心兼容、2248 项历史基线及 72 项测试桥均通过。验证是在仓库外、无 Git 数据库、重新安装锁定依赖后完成，见 [independence.json](../evidence/independence.json)和[本轮汇总](../evidence/memory-beta2-summary.json)。原 125 个历史文件、191 个来源对象与原始测试不改；翻译政策对应的原有 8 项替换断言范围不扩大。

## 专门补测启动场景

报告：[startup-memory-beta2.json](../evidence/startup-memory-beta2.json)。测试读取经过 SHA-256 核验的 beta.1 运行对象和当前候选，使用自己的 macOS JSC 进程及自写数据，不请求网络、不播放音乐、不修改任何客户端。

覆盖 metadata、extended metadata、bootstrap、customize、scroll、context/connect JSON 与二进制，以及 3000 项稠密配置的目标关闭/开启/缺少场景。Loon/Surge 各使用 standard/compact，重叠数为 1/4/8；每版 180 个新进程、780 次调用，共 360 个进程、1560 次调用。每个夹具先确认改前改后输出和请求数一致；所有 Entry 均同步完成、零 HTTP。

测量保留已完成环境到整波结束，不强制 GC，不减启动开销。读取整个拥有进程的内核峰值，十进制 MB：

| 指标 | beta.1 | beta.2 |
| --- | ---: | ---: |
| 最大 physical footprint | 77.55 MB | 38.14 MB |
| 最大 resident | 89.60 MB | 48.37 MB |
| 测量器记录的最长整波时间 | 656.445 ms | 765.682 ms |

这轮重点是减少分配，不能宣称每个冷启动都更快；上述时间包含夹具、JSC 和调度开销，尚未验证手机延迟与耗电。

**本次桌面启动模型的两项峰值均低于 50,000,000 字节，但它仍不包含原生 iOS 扩展、HTTP/TLS 缓冲、其他插件及实际启动流量。** 它与 beta.1 的歌词压力模型范围不同，不可把两者的数值直接混用。手机的 50 MB 及实际断线修复仍需在 iPhone 验证。

## 试用与状态

同一个 [Loon 测试订阅](https://raw.githubusercontent.com/hhhoratioxu/SpotifyLyrics/codex/spotify-memory-admission/Loon/script/SpotifyLyrics.lpx) 将提供 beta.2。手机平台保持 mobile，保留原设置；更新后的 Version Date 为 `2026-11-15 16:20:21`（台北时间）。main 继续 v3.2.3，beta.1 标签和附件保持原样。

本轮尚未操作真实手机或 Mac 客户端、播放音乐、部署诊断或读取账户凭据。用户要求继续更新测试版，发布完成后还需验证公开订阅、固定脚本和附件。
