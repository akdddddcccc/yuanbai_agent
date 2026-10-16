# 感知元白 · 学院公众号已部署网页 v6

归档日期：2026-10-16。学院公众号保留旧入口 `/yuanbai/explore/`，现在显示首页；正式游戏为 `/yuanbai/game/`，教学为 `/yuanbai/tutorial/`。`/yuanbai/` 也可进入首页。

## 下载与内容

- **yuanbai-school-v6-public.zip**：完整静态网页，共 87 个文件，包含首页、模型、正式游戏、互动教学、音频、字体及图片。
- **yuanbai-school-v6-upgrade.zip**：原轻量升级包，适用于现有 v5.1 网页；会检查旧文件哈希、备份并保留旧资源。不是从零安装包。
- **static-manifest.json**：87 个静态文件的 SHA-256。
- **live-verification.json**：2026-10-16 逐文件读取学院公开 HTTP 入口的校验结果，87/87 与本包一致。
- **SHA256SUMS.txt**：两个 ZIP 的校验值。

这份归档是现网可公开获取的静态网页版本，不是堡垒机整机备份；不包含服务器现场 Nginx 配置、真实排行榜数据库、登录令牌或密钥，也不包含旧版本残留的额外资源。

## 在现有学校环境恢复网页

当前网页目录为 `D:\yuanbai\public`。先将该目录备份到网站目录外，再将完整包 `public` **里面**的全部内容复制到该目录；不能形成 `public\public`。保留旧资源，先复制资源，最后替换首页、游戏和教学的 `index.html`。此操作只恢复网页；保留现场 `/api/yuanbai/game/` 代理及现有服务配置。不要把仓库的独立排行榜示例当成已部署配置。

线上地址：
- http://oa.design.bnuzh.edu.cn/yuanbai/explore/
- http://oa.design.bnuzh.edu.cn/yuanbai/game/
- http://oa.design.bnuzh.edu.cn/yuanbai/tutorial/

## 审核功能的实际状态

本次严格保存线上文件，前端已有昵称长度提示和 `nickname_rejected` 错误反馈代码。**这些前端代码不代表服务端昵称审核已启用。** 后续另行准备的学校独立审核后端、词库、旧昵称豁免与成绩迁移未作为已部署内容纳入此归档。此次不改变现网服务。

## 源码与验证

本归档所在分支以 `school/college-site` 的 `6f83ace9f4fd7c58946cd1ba4f66f2b5dc90a4d9` 为基线，同步实际部署所需前端及构建脚本。学校源码仍在 `school/`，共享游戏源码在 `public/explore/`，构建输出才使用 `public/game/`。

使用 Node.js 24+，执行 `npm ci`、`npm run school:build`，然后 `node school/verify-deployed.mjs`，可比较构建出的 87 个静态文件与本次归档。构建脚本为本地预览保留的后端模板不是现场部署证据。普通 `npm run build` 是原站构建，不用于本学校包。

学校版请通过 PR 合并到 `school/college-site`，不要将这份学校快照直接合入 `main` 触发原站发布。后续开发可从此分支/提交继续；改动后哈希不再等于本归档属于正常版本变化，应另建版本。

验证范围：静态文件字节一致、源码构建与自动回归；本次未操作服务器文件、未执行 Windows 安装器、未测试现网提交成绩或验证服务器审核状态。
