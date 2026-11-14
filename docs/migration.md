# 复制式独立迁移

2026-11-14，用户确认方案后建立 `Proxy/Spotify/`。该目录使用自己的 `.git`；父 Proxy、MapKit、WeatherKit 及其他项目原件不移动、不删除、不还原。父仓库的索引和 `.gitignore` 此阶段保持原样。

备份范围和逐文件哈希见 `provenance/parent-files-before.json`；本机 tar.gz 与校验清单的位置见 `provenance/migration.json`。备份含 888 个原件，其中 4 个 node_modules/.bin 符号链接分别核对链接目标和内容。最初备份检查因只统计常规文件而漏计符号链接，已按两类重新验证；原件未改。

稳定历史、Mac 来源及公开运行对象共 191 个逻辑源对象导出为本地内容快照。`tools/source-snapshot.mjs` 逐次检查路径、字节数和 SHA-256，未知对象拒绝读取；不会回退到父仓库 Git。当前维护源码复制在 `src/`，原始 125 文件保存在 `history/3.2.2/`。

所有原订阅地址及固定版本 URL 暂时保留：手机核心为 Proxy `10049053ce86bd992e3ebb6511ffb28312ba86fb`，Mac 为 `795c677b0d115cab5eb8e4f959424d905a98e3ff`。新本地入口只变更用户可见显示名，版本、参数、协议标记和缓存身份保持。父仓库入口未改，安装中的 Loon 插件未更新。

GitHub：`hhhoratioxu/SpotifyLyrics`，公开，与原 Proxy 一致。创建前已报告名称、可见性及同名查询 404，确认 CLI 身份为 hhhoratioxu；独立性验证通过后仅创建空仓库并配置本地 origin。随后 GraphQL 核实 nameWithOwner、visibility=PUBLIC、isEmpty=true。没有提交、Push、源码上传或发布版本。Codex 项目/分组由主聊天协调，本线程没有操作 Mac UI。

独立性验证在 Proxy 之外的临时目录执行：不复制 `.git`、node_modules 或备份，重新 `npm ci`，执行构建、当前回归和 2248 项历史基线。该检查不启动本地服务、不操作客户端或播放音乐。结果写入 `evidence/independence.json`。

扩展检查曾误用依赖本地 HTTP 服务的旧 `preflight.mjs`，在服务关闭时失败，记录保留为 `evidence/independence-network-preflight-failure.json`。新增进程内 `preflight-offline.mjs` 后，直接执行生成的原测试桥，72 个用例通过，网络请求为 0；不将这一结果写成原生压力或内存验收。

后续顺序：完成实际功能和内存验收；明确整体许可；核对新仓库名称、可见性和发布授权；发布固定对象及新入口；原 Proxy 保留兼容入口并说明迁移；确认用户已切换后才清理旧开发文件。若要求连兼容入口也完全删除，必须先切换订阅，不能同时承诺原 main 路径继续可更新。原历史固定提交链接通过保留原 Git 历史继续提供。

最终本地核对：888个原件未变，父仓库索引和忽略规则未变；子仓库分支为 codex/spotifylyrics-migration，尚无本地提交，origin 指向已核实的公开空仓库。当前父仓库仍会显示 Spotify/ 为未跟踪目录；不要将子仓库作为父仓库 gitlink 加入索引。父级忽略规则的后续处理留到获准阶段，当前不提前修改。

Spotify 路由列表、共享图标、其他 Proxy 项目均不属于此次删除范围。不得为了整洁改写父仓库历史或强制推送。
