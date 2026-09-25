# 探索元白

`index.html` 是实验室 `/yuanbai/explore/` 的游戏入口。这里存放完整的 SAN 版前端：`core.js` 负责 9×9 棋盘与游戏规则，`game.js` 负责画面、操作、环境感知与排行榜交互，`style.css` 和 `yuanbai-art.webp` 是配套视觉素材。

共享成绩需要同域的 `/api/yuanbai/game/{runs,finish,scores,leaderboard}`。这四个接口在 `portfolio-app-demos` 的 `edge-functions/` 中转发到原游戏服务，沿用其服务器回放、排行榜与数据库。先合并发布仓库的 `game/leaderboard-proxy`，再合并此分支；发布仓库会定时同步本仓库 `main` 的子模块指针。预览时如果没有这些接口，游戏仍能以练习模式游玩，但不会记入共享排行。

本目录保留旧 `assets/yuanbai-floor.jpg`，因为现有项目的构建检查仍引用该文件；新版画面使用 `yuanbai-art.webp`。
