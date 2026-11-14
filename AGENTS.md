# Proxy 仓库工作约定

本目录是 SpotifyLyrics 独立本地仓库。只在本目录维护；不得移动、删除或覆盖父 Proxy 和其他项目原件。先读 README.md、docs/migration.md、docs/acceptance.md 与 NOTICE.md。history/3.2.2/ 的 125 个历史文件及 provenance/objects/ 保持原字节。archive/ 是历史档案及隔离实验，默认构建不使用其实验源码。

用户可见名称 SpotifyLyrics；保留核心 3.2.2、x-verselyrics-internal、x-verselyrics、VerseLyrics.v1.cache 和原有参数。不全局替换历史名称。构建必须从本仓库快照读取，不能依赖父仓库 Git 对象。修改后执行相关回归；构建/依赖迁移执行 check:independent。

未经新的明确批准，不启用/更新客户端插件、不部署诊断、不改 Loon/VPN/网络设置。Mac 播放测试必须定向本机并保持系统静音及播放器音量 0。完整验收前不 Push，GitHub 空仓库创建先报告名称、可见性及同名查询结果。当前 Mac 无词补全失败、精确同步和 iOS 50 MB 未验收，不能把离线测试改写为实机通过。

用户指定：本仓库后续所有涉及 Loon 的项目，以以下官方文档作为首要依据。此要求也适用于其他目录中的共享源码，只要其产物包含 Loon 版本。

- 总览：https://nsloon.app/docs/intro/
- Script：https://nsloon.app/docs/Script/script_v2/
- Script API：https://nsloon.app/docs/Script/script_api/
- Rewrite：https://nsloon.app/docs/Rewrite/rewrite_v2/
- 插件：https://nsloon.app/docs/Plugin/

开始 Loon 工作前阅读 [Loon 官方文档适配记录](Loon/Docs/OfficialReference.md)；改动语法、运行时 API 或最低版本时重新核对对应官方页面，记录核对日期。仓库记录是实践摘要，官方更新优先。

各客户端使用自己的原生语法和 API，不把其他代理软件的参数直接移植到 Loon。不要猜测内存上限、取消请求能力或未公开的配置字段。对正文、缓存、并发、超时和异步完成做明确的边界处理；自动测试与真实设备的 VPN 稳定性结论分开报告。

发布前核对实际生成的导入文件和运行脚本；使用最新远端主分支并保护并发修改。GitHub 资源路径遵循现有大小写，插件与脚本放在各客户端的 `script` 下，路由列表放在 `rule` 下。
