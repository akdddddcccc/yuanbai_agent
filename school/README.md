# 探索元白 · 学校独立版

分支：`school/college-site`。学校首页、规则、4×4 教学地图和独立排行榜均从本目录构建。EdgeOne 的主分支、发布仓库和原有数据库没有切换。本分支不能直接合并进主分支触发原站发布。

## 预览与修改

需要 Node.js 24 或以上。首次构建先执行 `npm ci`，安装原首页使用的 React、Three.js 和 Vite；部署包已构建好，服务器无需安装 npm 依赖。

```powershell
npm run school:dev
```

打开终端显示的本机地址。预览只监听 `127.0.0.1`，排行榜使用内存测试数据库，退出后清空，绝不向原站或学校线上接口提交。也支持 `/yuanbai/` 子路径预览。修改源文件后重新运行预览，或运行 `npm run school:build` 并刷新。

- `school/SchoolPortal.jsx`：从原站 `src/Portal.jsx` 保留首页结构；直接复用 `src/PortalSculpture.js`、原模型、灯光投影、刻度交互和 `src/styles.css`。右侧对话入口改成规则与教学入口。
- `school/tutorial/lesson.js` / `immersive.css`：沉浸式教学的七步文字、按键亮度和完成流程。构建时复用正式游戏 Canvas、声音、地板、角色、小灯与全部道具动画，仅将地图缩成 4×4；不创建计分局。
- 第一次打开正式游戏会进入教学。进入时标记本浏览器已看过，完成或跳过后进入正式游戏；以后不自动重复。首页「探索规则」和游戏内「探索规则 → 重看互动教学」可重看。清理浏览器数据或换浏览器后会重新出现。
- 正式游戏沿用 `public/explore/`，学校构建加独立玩家身份键、返回学校首页和资源版本号；9×9 规则及服务端重放不变。
- `scripts/build-school.mjs` / `build-school-tutorial.mjs`：生成 `dist-school/` 学校专属网页、后端、配置模板和说明。原站源文件不改，旧版教学已移除。

```powershell
npm run school:test
npm run school:build
```

## 学校排行榜

本版按已确认的方案，把原网站已有成绩完整迁入学校榜单。使用 SQLite 一致性快照，保留正常榜、坠落榜、通关记录、玩家身份与昵称关联；原站照常运行。迁入后两边各自记录新成绩，不是实时同步。当前预览只有内存测试库，尚未读取或迁入真实成绩。

部署配置默认 `readOnly: true`，先导入、核对，再开放计分。原站数据库中的身份记录会保留，但浏览器身份令牌不会跨域自动转移；老玩家在学校新域名不自动登录，已有昵称的归属不会被覆盖。

## 手动部署（排版确认后再做）

1. 将构建包解压到新目录，例如 `D:\yuanbai-school`。网页仅在 `public/`，数据放 `data/`。先备份当前网页与 Nginx 配置。
2. 检查包内 `runtime\node.exe --version` 是 24+，并确认候选端口 4174 空闲；不使用现有的 8080 和 8083。若包内没有运行时，使用已核实的 Node 24+。
3. 把 `college-config.example.json` 复制为 `college-config.json`，按真实公开地址填写 `siteOrigin`（完整 HTTPS 来源，不带路径或尾斜杠）。示例使用 `https://oa.design.bnuzh.edu.cn`，它是待现场确认的配置值，不代表本包已验证该站 HTTPS。学校独立版的 `additionalOrigins` 保持空数组。
4. 在原排行榜服务器用 `services/leaderboard/database-transfer.mjs export <原数据库> <新快照.sqlite>` 导出一致性快照。用 Node 24+ 运行工具；不要直接复制正在写入的 SQLite 主文件。原库此前路径为 `/var/lib/yuanbai/leaderboard.sqlite`，操作前现场核实。将快照和同名 `.manifest.json` 一起传到学校的非公开 `backups/`，然后执行：

   ```cmd
   runtime\node.exe services\leaderboard\database-transfer.mjs restore backups\original-snapshot.sqlite data\school-leaderboard.sqlite
   ```

   工具校验哈希、数据库完整性、表记录数和迁移版本，拒绝覆盖已有目标。原站继续使用原库；不改原站网页、接口或配置。演练后若正式上线需更新快照，导入一个新的目标文件并调整配置，不能覆盖已经接收学校成绩的库。
5. 双击「启动学院排行榜.cmd」。后端仅监听 `127.0.0.1:4174`。这用于前台验收；正式运行需由学校管理员使用既有服务管理器或任务计划托管，配置开机启动、退出重试、日志和有数据目录权限的专用账号。
6. 参考 `deploy/nginx-school.conf`，把现有游戏的 location 替换为学校新版目录；API 改为服务器本机的 4174。移除旧游戏目录那条更长的 location，避免新版首页连接旧游戏。不要覆盖 Nginx 整份配置。
7. 先执行 `nginx.exe -t`，成功后才 `nginx.exe -s reload`。如果学校外层有 HTTPS 网关，还要确保页面和 `/api/yuanbai/game/` 均转发到本服务器，并保留原始 Origin 请求头。
8. 保持 `readOnly: true` 启动核对两榜人数、排名和昵称。确认快照无误、排版通过且准备正式上线后，将它改为 `false`，重新启动独立排行榜服务。
9. 默认入口 `/yuanbai/`，教学 `/yuanbai/tutorial/`，正式游戏仍是 `/yuanbai/explore/`。若后续换成官网 `/yuanbai-explore/`，静态目录可保持不变，调整入口映射并同步接通同域 API 即可。
10. 从实际公网 HTTPS 地址检查首页、教学、正式开局与通关提交、正常榜/坠落榜，再重启学校后端确认成绩持久化。到这一步才算学校服务器已对接；本地预览成功不等于已上线。

## 后续发布

从 GitHub 的 `school/college-site` 分支获取源码，在本地测试和构建后更新学校 `public/`。备份放在公开网页目录以外；更新包不含真实数据库，不能覆盖 `data/` 或现场的 `college-config.json`。网页更新无需重启 Nginx，配置变化才需要校验后 reload，后端变化需要重启该独立排行榜服务。

发布后若需要回退网页，恢复上一个网页版本即可。学校榜单一旦开始写入，回退服务前先备份最新数据，不能用旧快照覆盖新成绩。
