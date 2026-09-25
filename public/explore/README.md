# 探索元白

`index.html` 是实验室 `/yuanbai/explore/` 的游戏入口。这里存放完整的 SAN 版前端：`core.js` 负责 9×9 棋盘与游戏规则，`game.js` 负责画面、操作、环境感知与排行榜交互，`style.css` 和 `yuanbai-art.webp` 是配套视觉素材。

共享成绩需要同域的 `/api/yuanbai/game/{runs,finish,scores,leaderboard}`。目前发布域名还没有这四个接口，因此线上游戏以练习模式运行，通关成绩不能进入共享排行榜。若决定启用排行榜，需要由发布端单独接入服务器回放、排行榜与数据库，并在生产环境验证读榜和通关提交；仅发布本目录的静态文件无法提供成绩服务。

游戏上线流程与自动验收见仓库根目录 [TEAM_WORKFLOW.md](../../TEAM_WORKFLOW.md#探索游戏上线流程)。

本目录保留旧 `assets/yuanbai-floor.jpg`，因为现有项目的构建检查仍引用该文件；新版画面使用 `yuanbai-art.webp`。
