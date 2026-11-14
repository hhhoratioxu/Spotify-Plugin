# Mac 严格 B 诊断实测记录：2026-11-14

本次在重新获得 Mac UI / Loon 独占窗口后执行原 B 的五字段版本。正式 Spotify 插件始终关闭；固定核心、原参数、匹配条件不改，没有部署 JSON 元数据、previewLines 或 C0 候选。**无词曲补全仍未通过，iOS 50 MB 仍未验收。**

本文只对应已实测的旧 `160b564d…` 版本，其四个字节一致产物见 [历史清单](../../../evidence/native-b-20261114T172401/artifacts/manifest.json)。之后的 [输入兼容诊断修复](strict/INPUT-COMPATIBILITY.md)仅离线完成，不能代替本文的实测数据。

## 当次准备与范围

导入文件 SHA-256 为 `160b564ddfcc0e117f8d732215789980d7e6e5a8f56dd0d866ae7a1657c2cf37`，四个实际服务文件逐一核对 manifest。Loon Mac 为 0.5.0 (1011)，测试前显示 Connected、14 个插件 / 5 个启用，正式 Spotify 参数为 mobile / standard，全部 13 项保存于 [t0.json](../../../evidence/native-b-20261114T172401/t0.json)。

本次 17:24:01 新备份包含实际配置目录 `/Library/Application Support/com.loon.Loon/config` 的两份可见配置、隧道内部配置，以及脚本、插件、缓存和索引，共 133 个文件。43 份脚本缓存包括共享文件。原件稳定读取、备份哈希和私有目录重建均通过；备份不发布。没有使用 MapKit / WeatherKit 的旧快照。

临时服务仅监听 `127.0.0.1:18765`，提供本次四个文件及五字段事件；没有采集请求 URL、凭据或正文。导入后临时插件自动启用，显示 15 个插件 / 6 个启用，正式插件仍关闭。既有插件、节点、VPN、系统代理和证书没有手动更改。

## 界面观察与诊断结果

| 公开测试曲 | 实际观察 | 结论 |
| --- | --- | --- |
| a-ha / Take on Me，`spotify:track:2WfaOiMkCvy7F5fcp2zZ8L` | 核对搜索结果 URI 后播放，打开原生歌词页；Show lyrics 已选中，视图共有 45 个文本节点 | 本曲歌词页可用；本轮没有逐条核对内容，也没有验证精确高亮、滚动或完整时间轴 |
| 王俊凱 / 那页夏天，`spotify:track:76XUZSb13QUuj1HECY4Hvo` | 输入该 URI，核对选中行和 Now playing；歌词视图中 Show lyrics 为 disabled | 没有显示补充歌词，未通过 |

保存的 [events.json](../../../evidence/native-b-20261114T172401/events.json) 共 22 条，即 11 对 before / after：lyrics 7 对、metadata 4 对。每条恰好只有 `route`、`stage`、`pair`、`publicTargetMatched`、`lyricsFlags`。全部 `publicTargetMatched=false`、`lyricsFlags=["unknown"]`。这些记录不足以归属到目标曲目，也不能确定线上编码、标记值或入口失败根因。没有把 unknown 当作 false，更没有据此部署候选修复。

原始界面正文、歌词和非目标曲目身份未保存。公开曲目的最小观察见 [observation.json](../../../evidence/native-b-20261114T172401/observation.json)。

## 音频边界与操作偏差

开始时系统为 MacBook Pro Speakers、音量 0.4375、静音关闭；测试前下调到 0。Spotify Connect 明确显示 This computer，无其他设备。Spotify 音量滑块的 AX setValue 和 paste 未实际生效，后用静音按钮和 typeText 成功，实际测试两首时播放器为 0。

有一次坐标误触短暂播放了非目标曲目，发现后立即暂停；该阶段系统输出仍为 0，但播放器尚为 1。未保留该曲身份。收尾系统静音勾选为关闭、音量仍为 0，因此不能声称整个窗口都维持了“静音勾选开启”。系统输出为 0 保障没有音乐外放；本次操作不能记成完整严格协议通过。偏差见 [audio.json](../../../evidence/native-b-20261114T172401/audio.json)。

收尾先用可见 Play 按钮确认暂停，再恢复播放器音量 1、系统原音量 0.4375 / 静音关闭；未在恢复音量后播放。

## 实际内存采样

复用已有只读 monitor.py，按真实进程名验证 PID，使用 Apple top 的 MEM 计数。约 130.932 秒、每个进程 1399 条样本，总计 4197 条。没有读取进程内容或改变权限。

| 进程 | 窗口最大显示 | 折算十进制 MB | 保守显示范围 bytes |
| --- | --- | ---: | --- |
| Loon VPN 扩展 | 53M+ | 55.57 | 54,525,952–56,623,104 |
| Loon UI | 189M+ | 198.18 | 197,132,288–199,229,440 |
| Loon Helper | 5072K | 5.19 | 5,192,704–5,194,752 |

数据见 [memory-summary.json](../../../evidence/native-b-20261114T172401/memory-summary.json) 和 [process-memory.jsonl](../../../evidence/native-b-20261114T172401/process-memory.jsonl)。这是采样窗口最大值，包含其他活跃插件、流量和诊断额外 POST；没有隔离插件独占内存，也不是无诊断的性能验收或 iPhone 的 50,000,000 bytes 验收。不能把此次 55.57 MB 与其他窗口直接作优化前后对比。

## 撤回与恢复核对

- 已暂停 Spotify，停用并删除本次新增的精确诊断插件。Loon 最后显示 Connected、14 个插件 / 5 个启用，正式 Spotify 仍关闭。
- 两份可见配置和隧道内部配置共 3 份、43 份原脚本、15 份原插件均与当次 T0 SHA-256 一致；没有丢失原文件或残余新增脚本、插件缓存。
- 本次运行更新的共享歌词缓存，只用 17:24:01 当次备份恢复并复核哈希；恢复前的版本另存私有备份。没有清空缓存。
- 两个宿主 selected-policy MMKV 文件字节有变化，原因和语义等价尚未确定。为避免覆盖宿主状态，保留该变化并明确记录；不声称所有索引均已恢复原字节。没有手动切换节点。
- 临时服务已主动停止，18765 端口关闭；采样器已退出。17:35 后再次从 UI 确认暂停、原系统音量、插件数量和 VPN Connected，随后释放 Mac UI / Loon。

逐项结果见 [restore-comparison.json](../../../evidence/native-b-20261114T172401/restore-comparison.json)。本轮没有 Commit、Push、发布或切换订阅。
