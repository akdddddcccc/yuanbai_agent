# 探索元白：学院 Windows 部署与共享排行榜迁移

状态：部署材料，尚未在学院服务器安装或切换。基于 GitHub main 的游戏规则，保留游戏玩法、成绩回放校验和全部 SQL 迁移。

## 部署内容

- 游戏：`public/explore/`，学院网址路径 `/yuanbai/explore/`。
- 排行榜：`services/leaderboard/`，Node.js 24+，SQLite，本机监听 `127.0.0.1:4174`（候选端口，学院尚未核实是否空闲）。
- 数据：`data/leaderboard.sqlite`；不能放入 Nginx 网页目录或 `D:/job/` 的公开目录列表。
- `runtime/node.exe` 是便携运行时（若包内未包含，需放入官方 Windows x64 Node 24+）；不替换现有 Node，不需要 npm install。
- 仅迁移探索游戏和排行榜。AI 语音、模型和排队服务仍留在现有平台；学院游戏页面移除返回个人主页的按钮。

## 实际已知与待核实

已知：学院资产 `172.31.7.63` 为 Windows，Nginx 位于 `D:/nginx/nginx-1.30.4`；截图中的 server_name 为 `oa.design.bnuzh.edu.cn`，监听 80。8083 是视频服务的配置目标，8080 运行情况未知。

待核实：最终游戏域名、外部 HTTPS 入口（可能由上层网关提供）、学院 Windows 版本/架构、Node 24 支持情况、4174 是否空闲、独立目录可写权限、公网是否可访问游戏 API。`172.31.7.63` 是内网地址，不能直接填入 EdgeOne 当作公网目标。不能据 80 端口配置就假定 HTTPS 已可用。

正式游戏的 HTTPS 来源必须填入 `college-config.json` 的 `siteOrigin`，例如实际确认过的 `https://学院域名`，不带路径及末尾斜杠。保持 HTTPS 与精确来源检查，不为方便迁移关闭校验。`additionalOrigins` 保留原站域名，供原站代理访问。

## 只读预检

本阶段不启动、停止或修改学院现有服务。检查端口、Windows 版本和 Nginx 完整配置后再安排部署。

## 备份与验收准备

1. 在旧 VPS 使用其已有 Node 24 运行本包的 `database-transfer.mjs export`，对真实数据库 `/var/lib/yuanbai/leaderboard.sqlite` 做 SQLite 在线备份。需要一并传输数据库和 `.manifest.json`；该步骤需进入既有 VPS 部署会话，不能用浏览器排行榜导出代替全库备份。

   ```sh
   /opt/yuanbai-runtime/node-v24.16.0-linux-x64/bin/node database-transfer.mjs export /var/lib/yuanbai/leaderboard.sqlite /受控备份目录/leaderboard-preflight.sqlite
   ```

   工具只读打开源数据库，用 SQLite backup API 包含 WAL 中已提交数据，不直接复制活动主文件；报告只输出表记录数、迁移名称和 SHA-256，不输出玩家令牌或名字。每次必须用新文件名，拒绝覆盖已有备份。

2. 经授权把备份与清单传到学院服务器的非公开目录。建议解压部署包到新的 `D:/yuanbai`，确认与现有目录不冲突。
3. 使用包内 Node 导入到一个**不存在的新数据库路径**：

   ```cmd
   runtime\node.exe services\leaderboard\database-transfer.mjs restore backups\leaderboard-preflight.sqlite data\preflight.sqlite
   ```

4. 配置 `database` 指向 `data/preflight.sqlite`，填写已核实的 `siteOrigin` 和空闲端口，保留 `readOnly: true`。双击「启动排行榜.cmd」仅用于前台验收；不会注册系统服务，关闭该进程会停止这份新实例。原有服务不受影响。
5. 将 `nginx-college.conf` 的路径、端口调整到实际值，由管理员审核后加入对应站点的 server 块。它是增量片段，绝不能覆盖整个 nginx.conf；需检查是否已有同名 location。先备份原配置、执行配置测试，验证后再加载。该操作还没有执行。
6. 验证新站游戏页面、字体/音频/图片、排行榜正常榜与死亡榜、分页、已有成绩数；只读模式暂不允许开局计分。临时副本只能读，不得接收正式成绩。

## 正式切换：全程只保留一个写入库

1. 约定维护窗口，先等已开局玩家完成。将旧**排行榜**实例切为只读（适配版支持 `LEADERBOARD_READ_ONLY=1`），所有旧入口都必须停止写入；不要停止视频、FTP、语音或其他服务。若旧程序未升级，这一步需要单独部署适配或由管理员阻断这四个游戏接口的 POST，不能假定变量已生效。
2. 再做一次**最终备份**并传输、校验。验收用旧快照不能直接转为正式库，否则会漏掉之后新增的成绩。
3. 导入最终备份到一个新名称，例如 `data/live-20261009.sqlite`；将新实例的配置指向此文件、`readOnly: false`，启动新实例。不得覆盖正在打开的 SQLite 文件。
4. 学院 Nginx 的 `/api/yuanbai/game/` 转给新实例。旧个人站 EdgeOne 也必须改为同一学院公网 HTTPS API，保留游戏规则匹配的前端与后端。新的环境变量 `YUANBAI_GAME_UPSTREAM` 应为 `https://已核实域名/api/yuanbai/game/`，必须带末尾斜杠。
5. 通过学院入口完成一局、提交成绩，再从个人站读取同一榜单，并反向验证。检查时间、名次、通关榜、死亡榜和已有身份续用。发布仓库代理改动与变量设置应一起安排，变量未设置时仍指向旧 VPS。
6. 如果学院没有可供 EdgeOne 访问的公网 HTTPS：先保留旧库为唯一正式库，新学院副本继续只读验收，不能宣布共享排行榜迁移完成。校园网/VPN 可达不等于 EdgeOne 可达。

数据库保留并不代表浏览器身份跨域迁移：玩家 token 在原域名 localStorage 中；学院新域名会生成新身份，旧榜单仍在，但同名可能提示占用。原网站保留原域名、只切后端时，原身份可以续用。需要跨域认领旧身份时应另做明确的迁移流程，不能直接把 token 塞入 URL。

## 长期运行

前台启动仅用于验收。正式部署由学院管理员用既有 Windows 服务管理工具或任务计划程序托管 `runtime/node.exe services/leaderboard/deploy/windows/start.mjs <配置绝对路径>`，工作目录为部署根目录，配置开机启动、失败重试、日志留存，使用有数据目录读写权限的专用账号。不要依赖浏览器远程桌面一直开着，也不要直接用 `sc create` 把普通 Node 程序当成 Windows Service。

## 回退

- 新库尚未接收写入：恢复旧入口路由、解除旧排行榜只读即可，保持配置备份可用。
- 新库已经接收写入：先冻结新库写入，导出新库的最新完整备份，校验并迁回兼容的旧后端后才能恢复旧路由。不能直接切回旧快照，否则丢失新成绩。两个库发生独立写入时必须专项合并，不能简单互相覆盖。
- 保留旧源代码版本、Nginx 配置和最终迁移前备份；不删除旧服务、旧数据和其他项目文件。

技术参考：[Node SQLite backup API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html#sqlitebackupsourceDb-path-options)。
