# 元白项目三人协作说明

## 仓库关系

- 产品代码仓库：`akdddddcccc/yuanbai_agent`
- 发布仓库：`akdddddcccc/portfolio-app-demos`
- 线上地址：`https://apps-demo.muyang23333.top/yuanbai/`

日常界面与游戏开发优先在 `yuanbai_agent` 完成。`portfolio-app-demos` 负责统一域名发布和云端 `/api/yuanbai/chat` 接口，避免把它当作第二份前端源码重复修改。

## 三个人的主要范围

### 1. 游戏

- 主要目录：`public/explore/`
- 负责探索元白小游戏、素材、关卡、移动端触控和性能。
- 分支名：`game/功能名`，例如 `game/new-courtyard-level`。

### 2. 工作台网页与语料库

- 工作台入口：`src/Portal.jsx`
- 全局视觉：`src/styles.css`
- 页面路由：`src/main.jsx`
- 元白知识与说话风格：发布仓库的 `edge-functions/_shared/yuanbai-knowledge.js`
- 临时路演资料上传与解析：`src/KnowledgePanel.jsx`、`src/knowledgeFiles.js`
- 分支名：`web/功能名` 或 `corpus/主题名`。

改语料时只改事实与说话规则，不改请求、鉴权和语音合成代码。新增资料使用 `KNOWLEDGE_INTAKE.md` 的字段，注明来源、确认日期、可见范围和待确认项。

### 3. 语音交互

- 对话页面：`src/App.jsx`
- 建筑动画与灯光：`src/YuanbaiScene.js`
- 云端语音链路：发布仓库的 `edge-functions/api/yuanbai/chat.js`
- 本地 Python 链路：本地项目的 `voice/tts.py`、`voice/asr.py` 与 `config.py`
- 分支名：`voice/功能名`，例如 `voice/pause-and-lighting`。

语音成员不要修改 `SYSTEM_PROMPT` 中的知识内容；确需同时修改时，请让语料负责人参与审阅。

## 每次开发的固定步骤

```bash
git switch main
git pull
git switch -c game/你的功能名
```

把 `game/` 换成自己的范围。完成后运行本项目检查：

```bash
npm ci
npm run build
```

然后提交并推送自己的分支，在 GitHub 创建 Pull Request。合并前至少由另一位成员看一遍；不要三个人直接向 `main` 推送。

## 用 Codex 协作

每个人把仓库克隆到自己的电脑，在自己的分支或 Codex worktree 中工作。给 Codex 的任务要写清楚三项：当前分支、允许修改的目录、验收方式。例如：

> 在 `game/new-courtyard-level` 分支中只修改 `public/explore/`，增加中庭关卡并验证手机触控，不改工作台和语音接口。

Codex 生成改动后，先本地预览，再提交 Pull Request。三个人可以同时工作，因为各自使用不同分支；同一文件同时修改时，由该文件的主要负责人先合并，另一人再同步 `main` 并处理冲突。

## 密钥与大文件

- `DASHSCOPE_API_KEY`、`DEEPSEEK_API_KEY` 只放在本机环境变量或 EdgeOne 环境变量，禁止写进 Git。
- Blender、GLB、音频等大文件先沟通存放位置；超过普通 Git 适合的体积时使用 Git LFS。
- 不提交 `node_modules/`、本地录音、生成音频或个人配置。

## 建议的 GitHub 保护

为 `main` 建立规则：必须通过 Pull Request 合并、至少一人审批、禁止强制推送、合并后自动删除分支。等三人的 GitHub 用户名确定后，再加入 `CODEOWNERS`，让游戏、网页与语音目录自动请求对应负责人审阅。

## 探索游戏上线流程

这套流程只在产品仓库提交游戏代码。发布仓库已有 `sync-apps.yml`：每小时的 `:17`、`:47` 自动把产品仓库 `main` 的新版本同步到 `apps/yuanbai` 子模块，并触发 EdgeOne 部署。不要为每次游戏更新复制一份前端到发布仓库，也不要直接向两个仓库的 `main` 推送。

| 阶段 | 执行人 / 自动化 | 验收点 |
| --- | --- | --- |
| 开发 | 游戏负责人从最新 `main` 创建 `game/功能名`，主要修改 `public/explore/` | 桌面、手机预览；本地运行 `npm ci && npm run build` |
| 提交 PR | 游戏负责人提交 PR，写明玩法变化与截图 | `Explore game release / build` 通过，检查打包后的五项游戏资源 |
| 审阅合并 | 另一位成员在 GitHub 提交 **Approve** 后由维护者合并 | GitHub PR 有另一人的审阅记录；勾选 PR 模板并不等于审阅 |
| 自动发布 | 发布仓库同步子模块，EdgeOne 根据发布仓库 `main` 部署 | 发布仓库的 `Sync linked app repositories` 成功，部署完成 |
| 自动验收 | 本仓库 `Explore game release / production` 每小时的 `:00`、`:30` 运行 | 将线上 HTML、JS、CSS、画面素材逐一与本仓库 `main` 做 SHA-256 对照；最多重试约 2 分钟；读取排行榜并在运行摘要中报告状态 |
| 人工验收 | 游戏负责人打开 [线上探索页](https://apps-demo.muyang23333.top/yuanbai/explore/) | 检查桌面/手机移动、边界提示、SAN、道具、返回实验室；如要启用排行榜，实际完成一局并验证昵称成绩入榜 |

自动检查脚本可在仓库根目录手动运行：

```bash
node scripts/check-explore-production.mjs
# 仅在准备正式启用共享成绩时，要求排行榜也必须可用：
node scripts/check-explore-production.mjs --require-leaderboard
```

也可在 GitHub Actions 的 **Explore game release → Run workflow** 选择 `main` 并打开 `require_leaderboard`，运行正式成绩接口检查。定时检查默认只将排行榜故障标为警告：当前发布域名缺少 `/api/yuanbai/game/{runs,finish,scores,leaderboard}`，游戏会显示**练习模式**，不会产生入榜成绩；不能把静态页上线等同于排行榜上线。启用共享排名时应由有发布权限的负责人单独接入并审阅服务端接口，随后将这项检查设为必需并做一次真实通关提交验收。

如果静态资源校验失败，先核对发布仓库的同步任务和 EdgeOne 部署记录，再重跑验收；确有线上故障时通过 PR 撤回或修复产品代码，等待再次同步。由于本仓库当前操作者没有设置仓库规则的管理员权限，**必须由仓库管理员**在 `main` 的 Branch protection / Rulesets 中启用“必须通过 PR”、“至少 1 位其他成员批准”、“必须通过 `Explore game release / build`”、“禁止强制推送”；自动化脚本和 PR 模板都不能替代这条保护规则。
