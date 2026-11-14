# Mac JSON 元数据入口候选 · 未部署

这是 SpotifyLyrics 独立目录内的隔离候选，不改 `Loon/script/` 或已安装插件，不提供自动导入配置。原核心、匹配、歌词注入、缓存及逐字处理保持原样。候选本身不联网、不读写缓存、不计时、不记录请求内容。

已安装 Spotify 1.3.9.2055 的 V8 快照及隔离模块执行证明：availability 由 metadata/4/track 传输层**解码后的对象**的 has_lyrics 决定，false 会使后续歌词查询 disabled；查询缓存 staleTime 为 600000ms。该 helper 未明确指定 metadata 的 format，不能据此证明线上响应是 JSON。原核心明确跳过该接口的 JSON；候选只在这种表示确实出现时适用。离线测试以自写 JSON 重现 pass-through，并验证只改一个已验证字段。

**实际《那页夏天》的目标元数据响应尚未取得，连其线上格式都未确定；真实入口故障根因及本候选有效性仍未确认。** 二进制字段18、客户端读取 snake_case 的事实，不足以确定线上编码及 JSON gid/duration 的序列化。不得将严格夹具通过写成实机修复成功。

候选只接受已有 HTTPS spclient 域名的精确 GET metadata/4/track/<32位hex>、HTTP200、JSON MIME。正文最多128KiB，嵌套32层、32768值。必须包含与路径一致的16字节 canonical padded base64 gid、完整歌名/专辑/艺术家、正整数毫秒时长和显式 has_lyrics=false；不推断省略值，不猜测 hex/base64url 等其他格式，权限结构不明时不改。

按原始 JSON 的 token 位置将唯一根 false 改为 true，不 JSON.stringify 全文；未知大整数、格式、转义和嵌套字段逐字保留。重复/转义重复键、别名冲突、压缩原始字节、畸形 UTF8、超限、错误状态及来源/发现关闭全部回到原 Entry。输出清理旧正文校验/长度字段并保留 CORS 等其他响应头。未命中路径的候选没有新增行为，保留的原 Entry 自身仍可能执行原来的本地缓存逻辑。

2026-11-14 核对 [ProtoJSON 官方规范](https://protobuf.dev/programming-guides/json/)：bytes 可用 base64，布尔为 JSON boolean；本候选有意只接受更窄且能验证的表示。它不是完整 ProtoJSON 编解码器。[Loon Plugin](https://nsloon.app/docs/Plugin/) 确认显示名字段；未新增宿主 API 或提高最低版本。

```sh
node Loon/Development/SpotifyMacMetadata20261114/build-candidate.mjs
node --test Loon/Development/SpotifyMacMetadata20261114/candidate.test.mjs
```

测试仅 Node VM + 自写 JSON / 已有匿名公开 protobuf 夹具，无实际来源调用。原生复测需要另行确认具体配置动作；当前不启用新诊断、不改网络、不清客户端缓存。

另有 `mac-fallback-compat.mjs` 隔离候选：实际桌面模块91243直接调用 previewLines.map，而3.2.2自建补词结果没有该字段。固定运行核心在 QQ/网易夹具下输出200后，原桌面模块会抛 TypeError。候选仅在原404或严格确认原200为零行、无预览/权限标记，且原核心已成功生成自有来源歌词时，插入空 previewLines 数组；保留所有词、时间、未知数字/字段及网络调用次数。原200有词、权限提示、来源失败、畸形和未知结构均不补字段。它未接入正式脚本。

`desktop-modules.mjs` 只从签名程序包读取已核对哈希的四个模块，在 Node VM 中执行，React/query/transport 均为桩；不执行应用、不读取用户资料、不写出第三方模块文本。`evidence/desktop-contract.json` 与 desktop-chain.test.mjs 记录实际消费端契约。若程序包更新则失败并要求重新核对；无程序包的环境明确跳过相关测试。

当前用户已另行批准原B配对诊断，主聊天要求将其日志收窄为严格五字段，见 [严格B记录](../SpotifyMac20261114/strict/README.md)。UI窗口随后因星巴克任务撤回，尚未开测。B不部署本目录修复候选，也不自动执行C0。

若B证据不足，另备有 [NATIVE-C0-PLAN.md](NATIVE-C0-PLAN.md) 所述元数据观察方案；其字段和配置动作需要独立同意。已生成的 MetadataObserveMac.lpx 尚未导入、启用，不是本次已批准的B。
