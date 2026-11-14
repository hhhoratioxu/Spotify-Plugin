# Spotify Lyrics+ 持续开发约定

作者 Horatio（GitHub `hhhoratioxu`）。本目录是 2026-11-13 接手后建立的维护主线，基于真实的 VerseLyrics 3.2.2 恢复；不能将最早的 `SpotifyLyricsPlus` 文件与 VerseLyrics 的直接谱系视为已证实。

- 用户已确认旧版正常工作。维护以旧版和现有正式入口为基准；先复现具体问题，再做保留既有功能和配置的最小修改，不把需求差异或离线边界案例直接描述为旧版不可用。
- 先读本目录 README、`docs/implementation-status.md`、`recovery-manifest.json`；`history/3.2.2/` 的 125 个文件必须保持原始 Git blob 字节。`src/`、`dist/` 是隔离实验候选，不自动替换稳定基准；不要修改历史基线来让测试通过。
- 遵循上级仓库 AGENTS.md。Loon 工作先读 `../Loon/Docs/OfficialReference.md` 和 `docs/client-compatibility.md`；语法、API、最低版本变化时重新核对官方页面并记录日期。
- Spotify 有任何可用原生歌词时保留原始响应，包括静态歌词、翻译、逐字数据和未知字段。补词失败、未知结构、鉴权或服务错误必须回退原响应。
- 匹配准确性优先；不以列表顺序消除歧义，不猜测转写或跨语种别名，不伪造逐字时间轴。
- `source-policy.json` 的 API 调用和 Spotify 内展示授权核查单独记录。默认全部关闭的策略只适用于隔离实验候选，不修改旧版来源设置；`test-runtime/` 只供模拟 HTTP 的自动测试，不能导入客户端、上传或发布。
- 不读取、记录、缓存或转发 Spotify Authorization、client-token、Cookie；元数据使用已拦截的响应或无凭据的公开嵌入页。
- 每次修改运行 `npm test`。涉及历史恢复时运行 `npm run test:baseline`；报告必须分别列出历史基线、当前候选、模拟客户端和真实设备证据。
- 发布前检查 `dist/` 中实际导入文件、脚本哈希、大小写和同版本引用；使用最新远端 main，保护其他工作的并发修改。
- 未经用户确认不得 Push、发布或切换正式订阅。不得改删其他 Proxy、WeatherKit、MapKit 项目，禁止覆盖已有未提交修改。

长期任务与下一步验收记录在项目文档中，不把本机测试结果改写成 iPhone/VPN 稳定性结论。
