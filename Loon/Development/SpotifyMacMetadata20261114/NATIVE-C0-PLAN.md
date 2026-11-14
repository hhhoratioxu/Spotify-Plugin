# C0：最小元数据观察方案，等待另行批准

2026-11-14，台北时间。当前尚未导入或启用，没有启动服务、操作 Mac UI、播放音乐或修改网络配置。本方案不沿用已结束的 A 许可，也不自动执行旧 B 或任何修复候选。

需要回答的唯一问题：公开测试曲目的真实 metadata/4/track 响应究竟是什么格式、has_lyrics 的形状是什么，以及同轮是否能观察到 color-lyrics 响应。静态代码仅证明传输层解码对象的消费契约，不能证明线上一定是 JSON，更不能确认当前失败由 JSON 未适配造成。

## 拟批准的实际动作

总窗口最多约5分钟，需先由主聊天确认 WeatherKit 已释放 Mac 界面。

1. 只读核对当前 Loon 正式 Spotify 插件、平台、缓存参数和其他诊断状态。预期为正式插件关闭/mobile/standard。若与最后记录不同，不覆盖用户或其他项目的新状态，停止并报告。既有临时 GENERIC 内存插件保持原状，不运行、不趁机清理。
2. 只启动本目录 `observer_serve.py --seconds 300`，固定绑定 **127.0.0.1:18767**，默认300秒自动关闭，上限600秒。仅提供下列三个校验文件；无目录浏览、无代理功能、无POST采集端点。若端口被占用，不杀其他进程、不改端口或绑定地址。
3. 临时导入 `http://127.0.0.1:18767/MetadataObserveMac.lpx`，核对名称 **SpotifyLyrics Mac Metadata 观察（临时）** 与构建清单后仅启用这一个新增插件。正式 Spotify 插件保持关闭；旧诊断和其他插件保持原状。**不更新现有订阅/脚本、不启用候选、不修改原13个参数、不调整插件排序。**
4. 插件仅有3条 Response 规则：公开目标曲目的 metadata HTTP200 且声明长度不超过128KiB时读正文；其他元数据状态/超限只看响应头；目标曲目的 color-lyrics 只看响应头。零 Request Script、零 Rewrite、零来源搜索、零异步上报。解密域名只沿用现有 spclient.wg.spotify.com 与 *-spclient.spotify.com；不更改全局MITM或证书。
5. 仅在系统已静音、输出音量0、Spotify当前Mac设备音量0时执行一次“有词对照→目标曲目→暂停”。目标为《那页夏天》公开URI `spotify:track:76XUZSb13QUuj1HECY4Hvo`；对照沿用《Take on Me》`spotify:track:2WfaOiMkCvy7F5fcp2zZ8L`。任何音频前置条件不满足时先停止，不发送播放命令到其他设备。不做快进、反复播放或内存压力测试。
6. 只读取本插件 Script Records 的执行标签/时间以及以 `SpotifyLyricsMeta ` 开头的脚本自有日志；不打开/导出原始请求、授权头或歌词响应。检查灰色入口的实际界面状态，记录有事件/无事件和可观察范围，不把正常播放算补词通过。
7. 暂停本机播放，关闭并移除本次新增的精确名称插件，核对原正式插件和既有参数保持初始值；停止本轮自己的静态服务。核实Loon仍Connected。若界面失效或恢复无法核实，报告精确未恢复项，不盲点、不重启VPN或应用。

添加/启用插件可能触发客户端自身的正常配置应用；本方案不点击任何全局重载、不退出/重启Loon、不关闭/重连VPN，不改节点、系统代理、证书或其他插件。若客户端要求这些额外动作，停止等待新授权，不扩大本方案。

## 可核对的文件

以 [observer-artifacts.json](evidence/observer-artifacts.json) 的当前哈希为准，导入前必须核对实际文件。当前准备版本：

| 文件 | SHA-256 |
| --- | --- |
| MetadataObserveMac.lpx | eba8916c1a9186a08ca31b4fb6359861a80f0cdbfe13ee7d4bc4c12c6a505391 |
| body脚本 | 4f4d865be5540f5810ff7ca9b38d4c161e76520da977ceab62788bf6e28f52dc |
| header脚本 | d1b0d8f87a7474ce0ce47256971feeb6d3554cb8e93d0359d977850d6831b105 |

脚本名称包含内容哈希，避免误把旧缓存脚本当新版本。C0脚本只同步计算摘要、console.log、单次 `$done({})`；不回传改写正文，没有HTTP回调、计时器、缓存读写或凭据访问。每条日志最多2048字符，日志条数取决于真实请求，不能声称宿主全局日志存储有本插件可控的总容量。窗口结束即停用。

## 唯一采集字段

字段集合固定：schema、route、status、mime、encoding、inspection、bytes、flag、gidFormat、identityMatches、namePresent、albumPresent、artistsPresent、durationKind、accessFieldPresent、candidateWouldPatch。

其中 route 是 metadata/lyrics；mime、encoding、inspection、flag、gidFormat、durationKind 均为有限枚举；bytes最多记录131073表示超限；其余是布尔和状态码。只报告公共目标ID是否一致，不记录ID本身。歌名/艺术家/专辑仅为存在性布尔，时长只报告类型。candidateWouldPatch只是内存中计算当前JSON候选是否适用，不将其结果交回Spotify。

不采集或上传 Spotify 登录凭据、Authorization、client-token、Cookie、任意原始URL/查询、设备/账号标识、歌名/歌词正文、完整元数据、播放历史或原始响应头。静态服务只供GET导入文件；摘要只留在脚本日志和后续人工选择的去敏证据中。日志失败或异常格式仍单次 `$done({})` 放行。

## 判定与明确边界

- JSON + 身份一致 + 显式false + candidateWouldPatch=true：才说明当前JSON候选覆盖该**响应形状**；仍未证明入口已经可用。之后部署候选需要新许可。
- JSON但gid为hex、字段省略/别名、权限字段存在，或protobuf：据实际摘要决定下一处小修；不猜字段或强行套用base64 JSON条件。protobuf字段18与cosmos字段13不能混用。
- 没有目标日志：仅能报告本窗口未观察到脚本执行；可能是查询缓存、feature gate、图片依赖、请求方法/路径、规则优先级或解密命中问题，不能断言没有HTTP请求。
- 可用性查询的静态staleTime为600000ms。它不是自动重查计时器；不清Spotify/歌词缓存、不重启Spotify来强求请求。若C0产生新false缓存，后续干预需单独考虑查询新鲜度，不能马上启用候选就宣称失败或成功。
- C0若不能取得元数据，下一步才评估范围更大的B配对或Spotify重启；本许可不覆盖它们。
- C0不测补词成功、精确高亮、逐字、长时稳定或iOS50MB，也不作为Push条件通过。

## 最小阻碍

离线已能重现桌面入口门控及生成歌词缺previewLines的解析错误，也验证候选的安全回退。但没有真实目标响应的格式/身份/标记摘要，无法确定JSON入口候选是否走到实际客户端路径。取得该证据需要上述新增插件的临时配置动作；当前恢复授权不涵盖它，须等主聊天取得明确同意。
