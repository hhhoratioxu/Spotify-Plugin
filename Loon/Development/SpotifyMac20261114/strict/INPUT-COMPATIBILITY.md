# B 诊断输入兼容修复：纯离线，2026-11-14

本文保留 18:12 时 `41745acb…` 的纯离线阶段与 131/5 结果；后来该版本已于 23:04 实测并撤回。当前严格诊断增加精确公开请求的本地比对，SHA `04d6c9c3…`，150/6 预检；独立修复包也已另行实测。最新状态及未通过项见 [两端修复记录](../../../../docs/repair-2026-11-14.md)，下文旧“未部署”均指当时阶段。

旧诊断只接受 `ArrayBuffer.isView`，并跳过 JSON。直接 ArrayBuffer、字符串和 JSON 即使含有已知标记，也可能得到 `publicTargetMatched=false`、`lyricsFlags=["unknown"]`。因此旧 B 的 22 条记录不能排除目标出现，也不能确定线上响应格式或入口失败根因。本次修复诊断读取，不改生产行为。

该阶段导入文件 SHA-256：`41745acbf50bf55e921bc767ed7bf8a03c187b0003c5b4650aaeb149294cfb4c`，四文件已保存于[该版本实测清单](../../../../evidence/native-fix-20261114T230410/artifacts/manifest.json)。当前最新构建另见 [manifest.json](manifest.json)。更早已实测的 `160b564d…` 保存在 [历史产物](../../../../evidence/native-b-20261114T172401/artifacts/manifest.json)，旧实测记录和事件不改成新版本通过。

## 读取边界

- 输入限 131072 字节，含直接 / 跨 realm ArrayBuffer、typed array 和 DataView；view 只读取 byteOffset / byteLength 范围，不复制其前后字节。拒绝 SharedArrayBuffer、已分离缓冲区和伪造对象。
- 字符串按严格 Unicode 标量计算 UTF-8 字节数，拒绝孤立代理项；只把 JSON 文本识别为文本，不猜二进制字符串。JSON 字节手动严格解码 UTF-8，拒绝截断、非法 continuation、overlong、代理项和超出 Unicode 范围的编码。单个 UTF-8 BOM 可识别。
- JSON 先检查完整语法、所有重复 / 转义重复键、字符串、最多 24 层 / 8192 节点，再只读取已知字段。超限、格式错误和未知结构的歌词标记都是 `unknown`，不转成 false。
- metadata.Track JSON 只读取根 `gid` 和 `has_lyrics` / `hasLyrics`。gid 只接受 16 字节对应的严格 32 位小写 hex 或规范 base64；仅本地精确比较已定公开目标。两个别名同时存在视为含糊，标记 unknown。这是诊断支持范围，不能证明真实接口采用这些 JSON 形式。
- connect-state 只读取原有 `player_state.track/prev_tracks/next_tracks`；context-resolve 只读取原有 `uri/pages[].tracks[]`。最多 16 个完整曲目项，精确比较 track URI；metadata 映射仅保留布尔或字面 true/false，缺失记 omitted，其他值 unknown。不遍历任意嵌套 has_lyrics，不根据歌词行推断可用性。
- extended-metadata、lyrics、player-cards 和 lyrics-entry 的未知 JSON 结构仍记 unknown，不猜新 schema。跨曲目的 flags 与 publicTargetMatched 不能按数组位置自行关联为当前播放曲目。

五字段及类型保持原批准 schema：`route`、`stage`、`pair`、`publicTargetMatched`、`lyricsFlags`。**publicTargetMatched 始终是布尔值；true 为确认出现，false 仅为未确认，不代表确认非目标。** 不增加字段、格式标签、身份已知标志或原始 URL / ID / body / 凭据。接收端继续拒绝字符串 `"unknown"` 身份值。没有实际歌词、标题或敏感响应进入事件。

## 保持的行为与验证

三份固定 Mac 核心完整原字节嵌入，工作目录正式脚本与来源快照也同字节。原 B 配置除三份运行脚本文件名外保持原字节，域名、规则、12 项参数、超时和 MITM 不变。没有加入 metadata JSON 修改器或 previewLines 候选；JSON 识别函数只返回诊断布尔 / 枚举，不编辑输入。原核心对 metadata JSON 的保留和既有 player JSON 的 false→true 行为均有回归。

本轮预检 **131/131 Node，5/5 Python，0 失败、0 跳过**：32 项包装与传输 / 原数据保留，35 项输入归一化，46 项已知 JSON 与错误结构，13 项单曲 Protobuf，5 项历史 / 生产保护。Python 在禁用 socket 构造的条件下加载并执行接收端测试。191 个来源对象与 125 份历史文件校验通过；恢复演练只访问一次性自写文件，不访问真实 Loon。

结果见 [b-offline-preflight.json](../../../../evidence/b-offline-preflight.json)。没有 UI、播放、监听、网络请求、Loon 配置 / 缓存操作或 Push。两个 selected-policy MMKV 的旧字节差异继续保持“语义未确定”的记录，本轮不访问或覆盖它们。

## 下一轮最小原生验证

等待主聊天明确释放 UI 与 Loon，重新取得当次配置、参数、共享缓存 / 索引备份并核可恢复；只使用当前新 SHA。正式 Spotify 保持关闭，不改其他插件或网络设置。若前置条件不满足，不开始部署。

只在原有约 10 分钟窗口内启用本机回环服务和当前 B：先在播放器暂停时核对本机设备、系统静音勾选和两处音量 0；原两首公开曲目各观察一次，避免坐标盲点，不清 Spotify 缓存。观察仍限五字段，先看能否识别实际输入，再看相同 pair 的标记；任意 unknown / 未确认都不推断根因。没有被客户端请求的接口，不能靠播放器解码对象猜成线上 JSON。

及时暂停、保存最小事件、删除本次精确插件、主动停止服务；按当次备份核对配置和原缓存，遇到未知并发变化保留并报告。最后确认暂停、恢复原音量、VPN Connected 后释放。该轮只验证 logger 的实际输入兼容；无词补全、精确同步、无诊断性能与 iOS 50 MB 分别保留原验收结论，不部署功能候选。
