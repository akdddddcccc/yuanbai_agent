# 感知元白 · 学院公众号版

当前归档：**v6，2026-10-16 与学院公开静态文件逐项核对，87/87 一致。** 完整网页包、原轻量升级包和校验记录见 [已部署版本归档](../releases/school-v6-20261013/README.md)。本分支供学校环境使用，合并目标为 `school/college-site`，不要合入 `main` 触发原站发布。

## 当前入口

| 用途 | 学院网址路径 |
| --- | --- |
| 公众号原入口 / 新首页 | `/yuanbai/explore/` |
| 首页兼容入口 | `/yuanbai/` |
| 正式游戏 | `/yuanbai/game/` |
| 互动教学 | `/yuanbai/tutorial/` |

首页保留元白楼 3D 模型和探索入口；首次点击游戏会进入教学，完成或跳过后进入正式游戏。直接打开游戏地址不会被强制跳转。游戏与教学都返回公众号首页。教学状态仅保存在当前来源和浏览器中。

## 本地开发

需要 Node.js 24+。

```sh
npm ci
npm run school:dev
```

只监听本机，排行榜使用内存测试库。修改源码后重新构建：

```sh
npm run school:test
npm run school:build
node school/verify-deployed.mjs
```

最后一条逐文件比较本次 v6 归档；后续功能开发导致哈希变化时，应另行创建新版本，不能重写这个历史归档。

源码分工与文件导航见 [HANDOFF.md](HANDOFF.md)。`public/explore/` 是游戏源文件，学校构建输出到 `dist-school/public/game/`。构建后的 `dist-school/public/explore/index.html` 才是公众号首页。

## 服务器状态与部署边界

现有网页目录为 `D:\yuanbai\public`。本次 GitHub 归档不更新服务器，恢复网页的操作见归档说明。保留现场 `/api/yuanbai/game/` 代理，不因更新静态文件而切换到本机 4174。

仓库保留独立排行榜、SQLite 迁移工具和 `school/deploy/` 示例，供本地预览和以后单独部署使用；这些内容不是学校现场的配置备份。真实成绩库未纳入归档，也不以构建通过推断学校已迁移数据库。

前端已有昵称长度及审核失败反馈，但服务端昵称审核、旧昵称豁免属于另外准备的未启用后端方案，此归档不安装或启用它。仅凭网页提示不能判断后端审核状态。
