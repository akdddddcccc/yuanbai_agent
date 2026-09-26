# 探索元白

`index.html` 为 SAN 游戏入口；`core.js` 负责规则，`game.js` 负责画面、操作与云端排行榜。通关后可填写名字并在结束页“已通关”名单中看到排名、用时和日期。

前端使用同域 `/api/yuanbai/game/{runs,finish,scores,leaderboard}`。发布仓库的 EdgeOne 函数转发到用户 VPS，服务与持久化 SQLite 部署见 `services/leaderboard/README.md`。断网时可以练习但不入榜；已有成绩不会因刷新或重启丢失。

游戏仍默认静音。保留旧 assets/yuanbai-floor.jpg 供现有构建检查使用；新版画面为 yuanbai-art.webp。
