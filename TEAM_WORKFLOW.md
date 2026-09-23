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
- 元白知识与说话风格：发布仓库的 `edge-functions/api/yuanbai/chat.js` 中 `SYSTEM_PROMPT`
- 分支名：`web/功能名` 或 `corpus/主题名`。

改语料时只改事实与说话规则，不改请求、鉴权和语音合成代码。事实有不确定性时，在 Pull Request 里注明来源或待确认项。

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
