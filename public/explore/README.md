# 探索元白

`index.html` 为 SAN 游戏入口；`core.js` 负责规则，`game.js` 负责画面、操作与云端排行榜。通关后可填写名字并在结束页“已通关”名单中看到排名、用时和日期。

前端使用同域 `/api/yuanbai/game/{runs,finish,scores,leaderboard}`。发布仓库的 EdgeOne 函数转发到用户 VPS，服务与持久化 SQLite 部署见 `services/leaderboard/README.md`。断网时可以练习但不入榜；已有成绩不会因刷新或重启丢失。

游戏仍默认静音。保留旧 assets/yuanbai-floor.jpg 供现有构建检查使用；新版画面为 yuanbai-art.webp。

## 开场热身与回退

三页玩法介绍的最后一步进入独立的 3×3 热身。九格都是安全格，没有道具、SAN、计时或成绩提交；只显示脚下、正前方一格及全部走过的格子。走遍九格后可进入正式探索，也可跳过或重新热身。WASD、方向键、屏幕按钮与点击可见邻格均可操作，Q / E 原地转向。仅仅看见某格不会增加进度。

热身规则和界面分别在 `warmup.js`、`warmup.css`，不修改正式 `core.js` 或服务端回放协议。介绍仍沿用 `yuanbai-guide-seen-v1`，仅首次自动打开；老玩家可在尚未出发时从「玩法」重新阅读并进入热身。正式局开始后查看玩法仍直接回到该局，不再插入热身，以保持原有服务端计时和成绩规则。

回退有三种方式：

1. 单次预览原流程：在游戏网址加 `?warmup=off`（已有参数时用 `&warmup=off`）。介绍最后一页恢复「开始探索 / 回到探索」。该参数不写浏览器存储。
2. 全站关闭：将 `index.html` 中 `id="warmup-dialog"` 的 `data-enabled="true"` 改成 `data-enabled="false"` 后按原有流程发布。无需清空用户昵称、成绩或首次引导记录。
3. 代码回退：对本次独立提交执行 `git revert <热身提交号>`，再按原流程发布；不要重置整个主分支，以免覆盖其他成员的新改动。修改前基线为 `d9a3ee6`，本地备份标签为 `backup/yuanbai-before-warmup-20260927`。

验证：`node --test tests/explore-warmup.test.mjs`，并运行项目的 `npm run build`、`npm run test:sites` 与 `npm run test:leaderboard`。浏览器检查介绍衔接、九格完成、转向视野、重试、跳过、Esc、移动端和 `?warmup=off`。
