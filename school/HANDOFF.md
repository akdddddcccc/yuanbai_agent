# 学院公众号 v6 交接

归档日期：2026-10-16。详见 [版本说明、ZIP 和线上校验](../releases/school-v6-20261013/README.md)。本次以学院当前公开网页为准，不是把包含后续后端方案的本地交接目录整体发布。

## 开发文件导航

| 修改内容 | 源文件 |
| --- | --- |
| 学校首页标题、描述、游戏入口 | `school/SchoolPortal.jsx` |
| 首页布局、手机适配 | `school/school.css` |
| 入口挂载与基础标题 | `school/main.jsx`、`school/index.html` |
| 首页模型、灯光与投影 | `src/PortalSculpture.js`、`public/models/yuanbai-perception-sculpture.glb` |
| 首次从首页进入教学的判断 | `school/entry-gate.js` |
| 教学流程、结束动画、手机提示 | `school/tutorial/lesson.js`、`school/tutorial/immersive.css` |
| 游戏规则、交互、页面与样式 | `public/explore/core.js`、`game.js`、`index.html`、`style.css` |
| 学校游戏补充样式 | `school/school-game.css` |
| 公众号首页路径、游戏副本、资源版本 | `scripts/build-school.mjs` |
| 4×4 教学副本 | `scripts/build-school-tutorial.mjs` |
| 本机预览和内存排行榜 | `scripts/preview-school.mjs` |
| 回归与归档哈希验证 | `school/tests/school.test.mjs`、`school/verify-deployed.mjs` |

## 交互与路径约定

- `/yuanbai/explore/` 保持公众号历史链接，现在显示首页。
- 首页的游戏链接为 `game/?from=home`，首次进入先教学；已有 `seen` / `complete` 状态不再强制教学。
- `/yuanbai/game/` 是正式游戏；直接访问不触发首页首次引导。
- `/yuanbai/tutorial/` 可主动重看；不创建正式计分局。
- `yuanbai-school-onboarding-v2` 是浏览器教学记录；学校玩家身份键与原站区分。
- 首页别名通过 `<base href="../">` 保持模型、脚本、样式与链接相对 `/yuanbai/` 正确解析。

## 版本证据

以 `school/college-site` 的 `6f83ace9f4fd7c58946cd1ba4f66f2b5dc90a4d9` 为 Git 基线，同步部署所需前端变化。部分共享静态文本恢复了部署包中的换行字节（包括 CRLF），以与线上资源逐字节一致；`.gitattributes` 防止跨平台检出时改写这些字节。重新构建得到的 87 个静态文件与 v6 清单一致；学院 HTTP 读取的这 87 个文件也全部匹配。未核验服务器完整目录、现场配置和真实数据库，也未在此次归档过程中重新部署。

## 后端边界

`services/leaderboard/` 及 `school/deploy/` 保留基线代码和示例，不宣称它们就是学院当前运行的后台。构建时后端引用路径随游戏产物从 `explore/` 改为 `game/`。本地预览仅使用内存库；正式数据库迁移、审核词库、旧昵称豁免和代理切换需另行处理。此次 ZIP 仅包含静态网页。

## 继续协作

从该归档提交拉出学校功能分支开发，完成学校回归与构建，通过 PR 合并到 `school/college-site`。如修改共享游戏文件，另外评估原站兼容性；不要直接把学校版合入 `main` 发布。学校网页更新应先备份、先资源后入口，并保留旧资源供已打开的浏览器使用。
