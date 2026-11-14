# 独立仓库迁移

目标仓库：[hhhoratioxu/SpotifyLyrics](https://github.com/hhhoratioxu/SpotifyLyrics)，公开。用户于 2026-11-15 明确要求将 Spotify 项目全部转移到新 GitHub 仓库；本次据此上传完整项目和迁移后的安装入口，不将设备验收待办当作已通过，也不创建 GitHub Release。

## 保留范围

独立目录 `Proxy/Spotify/` 使用自己的 `.git`。当前维护源码、五个客户端原生入口与运行文件、README / 安装说明、测试、Mac / 手机内存工具、公开实测证据、历史 Egern 档案及隔离恢复实验均一并保留。

125 个 `history/3.2.2/` 文件与 191 个逻辑来源对象保持原始字节，按 SHA-256 核验。原 Proxy 最新主分支 `823e6a8cbc89f4e6b697bea17a2f43820a632b86` 的 Spotify / VerseLyrics 路径用 Git fast-export / fast-import 独立导入：101 个相关提交，历史共 3179 个路径；逐提交核对原始 blob ID、作者、提交者、时间与说明。过滤后的提交 ID 与原提交的对照保存在 [git-history.json](../provenance/git-history.json)，原历史分支为 `archive/proxy-history`。

导入历史只包含 Spotify 相关路径，没有导入 WeatherKit、MapKit 或其他代理项目。过滤后提交哈希与签名不能当作原提交签名；原仓库历史保持不变。

另外逐文件核对当前父目录的 351 个 Spotify 插件文件：已在当前树或迁移 Git 历史中的内容直接关联；11 份此前仅在本机的原版开发文件额外保存在 `archive/pre-migration-local/`。完整路径、大小、SHA-256 与保留位置见 [source-coverage.json](../provenance/source-coverage.json)。10 个共享路由 / 图标资产继续归属 Proxy。

## 安装链迁移

新入口集中在各客户端 `script/`，大小写保持一致。运行文件固定到新仓库的 `85803237600fc3701d369c10a5b9d7654d877a2b` 提交，18 个运行文件与 Unicode 许可文件的大小及 SHA-256 见 [runtime-release.json](../provenance/runtime-release.json)。迁移不改变这些运行文件的字节、核心 3.2.2、内部请求标记、缓存身份、来源、原参数或默认值。

Loon 继续使用原有 mobile / macOS 选择、原规则和体积保护；此次仅改主页、资源地址与迁移日期，保留编号功能描述。Surge、Egern、Quantumult X、Shadowrocket 继续使用各自原生格式与 API。历史快照、原兼容入口样本和档案中的旧 URL 不做全局替换。

现有用户须将旧 Proxy 订阅 URL 改为 [README 中的新入口](../README.md#安装)。旧地址保持兼容内容，不会自动变成新仓库地址；只更新旧订阅仍会获得旧内容。未修改已安装客户端、缓存或 VPN。

## 备份与其他项目

最初复制前的 888 个原件核对记录保存在 `provenance/parent-files-before.json`；本机备份位置见初次迁移记录。此次发布前另对当前子仓库和父仓库已跟踪文件 / 索引建立新基线与私有备份，结束时重新核对，保护已有的并发修改。

本地 `.migration-backup/`、node_modules、客户端账户 / 配置 / 证书均不上传。父 Proxy、WeatherKit、MapKit 及其他项目的文件、索引和 Git 历史不移动、不删除、不覆盖，也不向旧 Proxy 推送。旧入口保留给已订阅用户，新功能后续在新仓库维护。Spotify 路由规则继续属于 Proxy。

## 验证与仍待处理的工作

独立构建在 Proxy 之外的临时目录执行，不复制 `.git`、依赖目录或备份，重新 `npm ci` 后构建并运行当前回归、2248 项原始历史基线和 72 项进程内测试桥。安装链检查逐个核对新仓库固定 URL 及 18 个文件哈希。结果见 `evidence/independence.json` 和发布校验记录。

这些检查不播放音乐、不部署诊断，也不代替原生设备验收。Mac 无词补全、精确同步、iPhone 50 MB 和日文歌曲翻译继续记录在 [验收状态](acceptance.md) 与 [待修复问题](open-issues.md)。迁移上传不等同于新功能版本发布。
