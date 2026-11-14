# 安装、客户端兼容性与 Loon 核对记录

核对日期：2026-11-13。先阅读仓库的 [Loon 官方适配记录](../../Loon/Docs/OfficialReference.md)。本地候选尚未发布，Proxy 原正式入口没有改动。

## 客户端状态

| 客户端 | 本轮产物与证据 | 尚未验证 |
| --- | --- | --- |
| Loon，第一优先级 | 实际生成 `.lpx` 和两个响应脚本；必要 URL Guard、原生请求头 Rewrite、typed arguments、Uint8Array 与毫秒网络 timeout；最低 3.5.1（983） | iPhone 原生配置解析、真实 Spotify 缺词、连续切歌 / VPN / 电池 |
| Surge，第二优先级 | 实际生成 `.sgmodule`、Request / Lyrics / Entry；继续独立使用 binary-body-mode、max-size，HTTP timeout 在桥接层换算为秒；保留原模板 jsc/webview 选择 | Surge iOS/macOS 的原生导入及 Spotify 行为；不把历史版本建议等同本候选最低版本实测 |
| Egern | 恢复原生 `ctx` 异步 Response / stream 代码并执行模拟回归；没有套用 `$httpClient` 或 Loon 二进制模型 | 既有原生无词入口缺陷与当前设备行为；本轮不提供候选安装模块 |
| Quantumult X | 保留 `$task.fetch`、`$prefs`、bodyBytes 桥接及其已有限制，执行模拟回归 | 空响应时实际 rewrite 触发、状态 / 编码约束与设备验收；本轮不提供候选安装配置 |
| Shadowrocket | 保留独立编译适配及模拟回归；不复制 Surge engine 参数到该客户端 | 完整官方脚本规范与真实设备；本轮不提供候选安装模块 |
| Clash / Mihomo | 没有对应的 HTTP 响应正文脚本能力实现 | 不生成“通用可用”的歌词模块 |

## Loon 官方文档核对

2026-11-13 重新读取 [总览](https://nsloon.app/docs/intro/)、[Script](https://nsloon.app/docs/Script/script_v2/)、[Script API](https://nsloon.app/docs/Script/script_api/)、[Rewrite](https://nsloon.app/docs/Rewrite/rewrite_v2/) 与[插件](https://nsloon.app/docs/Plugin/)。

保留 3.5.1（983）新版 Script：每条规则单一 `script(...)` Action，两个响应 URL Guard 互斥，`requires_body=true`、`binary_body_mode=true`。参数通过已声明的原生对象传递，字符串 / boolean / number 分别声明；偏移 select 为 number，联网和来源为 string。未移植其他客户端的 `engine` 或 `max_size`。

网络沿用公开 `$httpClient`，Loon timeout 为毫秒，数据使用 Uint8Array，同步字符串存储。真实 HTTP 回调结束后单次 `$done`，没有新增取消请求 API、定时器或后台任务；不依赖可靠 clearTimeout。没有使用需要 Build 988 的压缩 / AES / DNS 新 API，最低版本保持不变。

当前来源清单为空，Loon 原生 Rewrite 不生成，两个 Response 条件都不会命中任何来源选项，避免为关闭的补词工作读取正文。源码及产物中的 256 KiB / 128 KiB 限制是脚本边界，不能承诺限制宿主已持有的未知长度缓冲。Surge 按自己的 [HTTP Request](https://manual.nssurge.com/scripting/http-request.html) 和 [HTTP Response](https://manual.nssurge.com/scripting/http-response.html) 文档处理，参数和单位不移植到 Loon。

## 本地安装复核

当前导入仅用于复核构建和后续具备授权时的设备测试；来源关闭时不会补出缺失歌词。不要把 `test-runtime/`、`history/` 或其旧正式 URL 当成新候选安装入口。

Mac 本机：

```sh
cd /Users/hhhoratioxu/Documents/CodeX/Proxy/SpotifyLyricsPlus
npm run build
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

在 Mac 的代理客户端手动添加以下本地地址：

- Loon：`http://127.0.0.1:8765/Loon/script/SpotifyLyrics.lpx`
- Surge：`http://127.0.0.1:8765/Surge/script/SpotifyLyrics.sgmodule`

iPhone 无法用 `127.0.0.1` 连接 Mac。需要自行填入同一局域网内 Mac 的实际 IP，重新生成资源 URL 后再启动局域网服务。例如 Mac 地址确实为 `192.168.1.20` 时：

```sh
LYRICS_ASSET_BASE=http://192.168.1.20:8765/ npm run build
python3 -m http.server 8765 --bind 0.0.0.0 --directory dist
```

对应添加 `http://192.168.1.20:8765/Loon/script/SpotifyLyrics.lpx`。该 IP 只是填写示例，不代表已发现的设备。服务只暴露 `dist/`，完成复核后停止；本轮没有替用户启动局域网服务或修改设备订阅。

安装时只启用一份 Spotify 歌词处理模块，使用代理客户端已信任的 HTTPS 解密证书。MITM 仅覆盖 `spclient.wg.spotify.com` 与 `*-spclient.spotify.com`，不加入 `accounts.spotify.com`。重新载入配置、重新打开 Spotify，再检查具体曲目；客户端没有发起歌词请求时，补词脚本无法强制渲染歌词页。

## 准备发布时

先完成来源许可与实机验收，生成同一构建的固定脚本及导入文件，再核对每条资源引用、SHA-256 和 GitHub 路径大小写。当前本地 URL 不应直接发布成正式订阅。读取最新远端 main 并采用预期 HEAD 保护并发改动，用户确认后才可 Push 或发布；不要重写工作区中已有的其他项目修改。
