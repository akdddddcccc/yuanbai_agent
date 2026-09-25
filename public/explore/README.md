# 探索元白

`index.html` 是实验室 `/yuanbai/explore/` 的游戏入口。这里存放完整的 SAN 版前端：`core.js` 负责 9×9 棋盘与游戏规则，`game.js` 负责画面、操作、环境感知与排行榜交互，`style.css` 和 `yuanbai-art.webp` 是配套视觉素材。

SAN 平衡版（规则版本 `yuanbai-v6-san-balance`）：每秒 +0.2、拾取 −8、坠落 +8；满值单格视野持续 5 秒后自动回落至 65。弹窗和后台暂停 SAN 增长，但排行榜的通关计时继续。旧版 `yuanbai-v5-san` 在排行榜中单独显示，避免难度变化影响比较。

共享成绩连接自己的服务器 `https://123.56.162.88/api/yuanbai/game/{runs,finish,scores,leaderboard}`，不修改发布仓库的前端或代理。服务端源码、部署步骤见 [排行榜服务](../../services/leaderboard/README.md)。服务部署并启用 HTTPS 后，游戏可在此页面直接通关、输入昵称和进入共享排行榜；如果服务不可达，游戏仍能以练习模式游玩。

本目录保留旧 `assets/yuanbai-floor.jpg`，因为现有项目的构建检查仍引用该文件；新版画面使用 `yuanbai-art.webp`。
