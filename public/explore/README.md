# 探索元白

`index.html` 为 SAN 游戏入口；`core.js` 负责规则，`game.js` 负责画面、操作与云端排行榜。通关后可填写名字并在结束页“已通关”名单中看到排名、用时和日期。

前端使用同域 `/api/yuanbai/game/{runs,finish,scores,leaderboard}`。发布仓库的 EdgeOne 函数转发到用户 VPS，服务与持久化 SQLite 部署见 `services/leaderboard/README.md`。断网时可以练习但不入榜；已有成绩不会因刷新或重启丢失。

游戏仍默认静音。保留旧 assets/yuanbai-floor.jpg 供现有构建检查使用；新版画面为 yuanbai-art.webp。

每次新开一局使用 `seeded-v1` 伪随机地图；坠落复位保持本局布局。每局仍为 15 个悬崖、66 个连通安全格，以及 5 个同伴、4 个探测、3 个全景道具。起点和相邻两格安全，附近至少有一个同伴道具，其余位置打乱。练习模式也会随机。

在线种子由服务器生成并保存在 `runs.layout_seed`，成绩用该种子重放；客户端提交的种子不参与成绩校验。`0003_layout_seed.sql` 仅新增可空列，旧客户端和既有局继续采用固定地图，已有成绩保留。先升级排行榜服务，再发布游戏前端。
