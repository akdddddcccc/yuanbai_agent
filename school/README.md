# 探索元白 · 学校独立版

分支：`school/college-site`。学校首页、规则、5×5 教学地图和独立排行榜均从本目录构建。EdgeOne 的主分支、发布仓库和原有数据库没有切换。本分支不能直接合并进主分支触发原站发布。

## 预览与修改

需要 Node.js 24 或以上，无需为学校版安装 npm 依赖。

```powershell
npm run school:dev
```

打开终端显示的本机地址。预览只监听 `127.0.0.1`，排行榜使用内存测试数据库，退出后清空，绝不向原站或学校线上接口提交。也支持 `/yuanbai/` 子路径预览。修改源文件后重新运行预览，或运行 `npm run school:build` 并刷新。

- `school/index.html` / `school/school.css`：学校首页、直接展示的规则、入口和榜单。Agent 入口已移除。
- `school/tutorial/`：5×5 教学状态、地图、按键反馈，移动 / 转向 / 三种工具。可以跳过、重置和再次练习。教学没有调用计分 API。
- 正式游戏沿用 `public/explore/`，构建时加学校首页链接、独立玩家存储键、资源内容版本号，并跳过重复的首次规则弹窗。玩法入口仍可查看完整规则。
- `scripts/build-school.mjs`：产生 `dist-school/`，内含网页、学校后端、配置模板和说明。教学文件不会参与后端的正式游戏重放校验。

```powershell
npm run school:test
npm run school:build
```

## 学校排行榜

本版默认准备一份独立的学校榜单，原站成绩继续留在原站。学生使用学校版浏览器身份，正式通关后由服务器重放动作并校验成绩。教学不计分；未连接后端的正式游戏只能练习，界面会明确提示。

如果最终决定迁入旧成绩，先用 `services/leaderboard/database-transfer.mjs` 导出与校验完整数据库，再导入新的非公开目录；不要把线上活动 SQLite 主文件直接复制，也不要覆盖已经接收学校成绩的数据库。迁移方案尚未执行。

## 手动部署（排版确认后再做）

1. 将构建包解压到新目录，例如 `D:\yuanbai-school`。网页仅在 `public/`，数据放 `data/`。先备份当前网页与 Nginx 配置。
2. 检查包内 `runtime\node.exe --version` 是 24+，并确认候选端口 4174 空闲；不使用现有的 8080 和 8083。若包内没有运行时，使用已核实的 Node 24+。
3. 把 `college-config.example.json` 复制为 `college-config.json`，按真实公开地址填写 `siteOrigin`（完整 HTTPS 来源，不带路径或尾斜杠）。示例使用 `https://oa.design.bnuzh.edu.cn`，它是待现场确认的配置值，不代表本包已验证该站 HTTPS。学校独立版的 `additionalOrigins` 保持空数组。
4. 明确新建独立学校榜单时，在部署目录执行一次：

   ```cmd
   runtime\node.exe deploy\init-school-db.mjs --new-school-board
   ```

   它拒绝覆盖任何已有数据库。再次部署网页无需重新初始化。若选择迁入旧成绩，跳过新建步骤，按迁移工具流程导入。
5. 双击「启动学院排行榜.cmd」。后端仅监听 `127.0.0.1:4174`。这用于前台验收；正式运行需由学校管理员使用既有服务管理器或任务计划托管，配置开机启动、退出重试、日志和有数据目录权限的专用账号。
6. 参考 `deploy/nginx-school.conf`，把现有游戏的 location 替换为学校新版目录；API 改为服务器本机的 4174。移除旧游戏目录那条更长的 location，避免新版首页连接旧游戏。不要覆盖 Nginx 整份配置。
7. 先执行 `nginx.exe -t`，成功后才 `nginx.exe -s reload`。如果学校外层有 HTTPS 网关，还要确保页面和 `/api/yuanbai/game/` 均转发到本服务器，并保留原始 Origin 请求头。
8. 默认入口 `/yuanbai/`，教学 `/yuanbai/tutorial/`，正式游戏仍是 `/yuanbai/explore/`。若后续换成官网 `/yuanbai-explore/`，静态目录可保持不变，调整入口映射并同步接通同域 API 即可。
9. 从实际公网 HTTPS 地址检查首页、教学、正式开局与通关提交、正常榜/坠落榜，再重启学校后端确认成绩持久化。到这一步才算学校服务器已对接；本地预览成功不等于已上线。

## 后续发布

从 GitHub 的 `school/college-site` 分支获取源码，在本地测试和构建后更新学校 `public/`。备份放在公开网页目录以外；更新包不含真实数据库，不能覆盖 `data/` 或现场的 `college-config.json`。网页更新无需重启 Nginx，配置变化才需要校验后 reload，后端变化需要重启该独立排行榜服务。

发布后若需要回退网页，恢复上一个网页版本即可。学校榜单一旦开始写入，回退服务前先备份最新数据，不能用旧快照覆盖新成绩。
