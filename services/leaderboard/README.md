# 元白探索 · 云端已通关名单

## 当前链路

浏览器访问 `https://apps-demo.muyang23333.top/api/yuanbai/game/{runs,finish,scores,leaderboard}`，由发布仓库 `edge-functions/_shared/yuanbai-game.js` 转发至用户服务器 `http://123.56.162.88/yuanbai-game/api/yuanbai/game/`。浏览器不会直接访问 HTTP，因此不会触发混合内容拦截。EdgeOne 到 VPS 当前是 HTTP；以后启用公网 HTTPS 时，只需替换代理的 UPSTREAM。

SSH 私钥只留在本机用于部署，不写入仓库、浏览器、数据库或 EdgeOne 环境变量。公开游戏不需要持有服务器管理密钥；随机玩家令牌只用于归属自己的成绩。

## 行为与排名

- 第一次游戏操作创建服务器计时记录，完整回放通过后允许留名。
- 自定义名字/昵称为 1–16 个 Unicode 字符，不接受控制字符和尖括号。输入以文本渲染。
- 正常榜先按坠落次数，再按通关用时、移动步数排序；完全相同则首次提交者靠前。每位玩家每个规则版本只保留最好的一局。独立的死亡次数榜按已验证通关中坠落最多的一局倒序排名。
- 每个浏览器身份、每个规则版本保留一个最好成绩。同名允许是不同玩家；清除浏览器数据或换设备会创建新身份。
- 结束界面自动显示前 20 名，提交成功后刷新；完整排行榜分页每页 20 人。
- 用时采用服务器开始到首次成功校验的时间，含思考、窗口停留、动画及请求延迟；重试成功校验不会重复累计。
- 重复提交幂等；差成绩不会覆盖好成绩。操作回放校验不是强竞技反作弊，不能阻止脚本完成合法路线。
- 仅旧规则数据存在时才显示历史榜；本次没有导入任何旧服务器数据库。

## 服务器位置

- 服务：`yuanbai-leaderboard.service`，专用低权限用户 `yuanbai`，监听 `127.0.0.1:4174`。
- 源码：`/opt/yuanbai-leaderboard/current`，发布目录保存在其 `releases/` 兄弟目录。
- 数据：`/var/lib/yuanbai/leaderboard.sqlite`（SQLite WAL）。重启、前端更新不会清空数据库。
- 专用运行时：`/opt/yuanbai-runtime/node-v24.16.0-linux-x64/bin/node`，不替换服务器现有 Node。
- nginx：`deploy/nginx-domain.conf` 包含在现有 HTTP 站点 server 块中，只增加 `/yuanbai-game/` 路由。

查看状态：`systemctl status yuanbai-leaderboard`。检查健康：`curl --fail http://127.0.0.1:4174/health`。日志：`journalctl -u yuanbai-leaderboard -n 50`。更新源码后 `systemctl restart yuanbai-leaderboard`。

备份请用 SQLite online backup API 生成一致的备份文件；不要只复制正在写入的主数据库而漏掉 WAL。备份与数据库都在非网站静态目录，定期复制到独立存储。

## 本地开发与测试

需要 Node 24+；无需额外数据库依赖。执行 `node --test services/leaderboard/test/server.test.mjs` 验证排序、身份、回放、重试幂等和磁盘持久化。

在临时数据库测试：设置 `PORT=4175`、`DB_PATH=:memory:` 后运行 `node services/leaderboard/server.mjs`；另一个终端设置 `YUANBAI_GAME_API_ORIGIN=http://127.0.0.1:4175`，运行 Vite。访问 `/explore/index.html` 进入游戏。未设置时 Vite 代理到 VPS。

结束页 HTML 在 `public/explore/index.html`，显示和提交逻辑在 `game.js` 的 `verifyFinish`、`submitScore`、`loadFinishers`；样式是 `style.css` 最后的 `.finishers`。服务 API 在 `api.mjs`，数据库初始化与版本迁移在 `sqlite.cjs` 和编号 SQL 文件中。
