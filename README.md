# 元白长者 · 语音建筑交互

元白楼人格化 AI Demo 的网页端。长按麦克风说话后，页面会调用部署端的语音识别、DeepSeek 对话和 CosyVoice 语音合成服务，并用声音能量驱动楼体灯光与体块动画。

线上入口：`https://apps-demo.muyang23333.top/yuanbai/`

## 本地开发

```bash
npm ci
npm run dev
```

本地默认请求 `/api/chat`，Vite 会将它转发到已部署的 `/api/yuanbai/chat`；部署到 `/yuanbai/` 后前端直接请求云端函数。API 密钥只配置在托管平台的服务端环境变量中，不应提交到此仓库。

## 三人协作

游戏、工作台与语料、语音交互的目录边界和分支流程见 [TEAM_WORKFLOW.md](TEAM_WORKFLOW.md)。每个人在自己的分支开发，通过 Pull Request 合并到 `main`。
