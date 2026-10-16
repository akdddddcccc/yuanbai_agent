# 元白公众版 · 学院与公众号网页部署

## 本次交付
一个总入口 `/yuanbai/`，两个子页面 `/yuanbai/explore/` 与 `/yuanbai/dialogue/`。沿用建筑模型与探索玩法，改为黑白灰中性色层级的 CloudAI 方向；图标为项目现有 Phosphor 图标，并非阿里官方原图。对话支持文字/语音，取消入场表演语音。公众语料保留学院、元白、教师公开研究，移除学生名单、班级映射及人物彩蛋。已有教师资料仍带原始时间边界，不代表本次重新核验了所有履历。

这次接入方式是**公众号菜单打开 H5 网页**，未开发微信消息自动回复、回调验签或账号绑定。未改学院现有 Python 服务。本方案使用现有发布仓库的 EdgeOne 接口，由学院 Nginx 同源反代；如果学院必须用本地 Python，需要先提供该服务源码再适配。

## 依赖顺序
1. 先部署发布仓库的公众问答修改：chat.js、新 public-knowledge.js、voice-queue.js、game.js。旧语料文件留在仓库供历史追溯，但活动 chat 入口不再导入它。
2. 在该发布项目的服务端环境变量中设置 `YUANBAI_ALLOWED_ORIGINS=https://实际学院域名`。多个来源用英文逗号分隔，不带路径与末尾斜杠。聊天、排队、游戏网关均检查此白名单。保留原有模型密钥；不要把密钥写入网页或发给助手。
3. 再上传静态网页并配置学院 Nginx。单独上传网页而不更新服务端，不会完成文字问答及公众语料切换。

## 静态目录
将压缩包 `web/yuanbai/` 整个目录上传至新版本目录，例如管理员确定的 `<release-parent>/yuanbai/`。必须包含 `index.html`、`dialogue/index.html`、`explore/`、`assets/`、`models/` 等全部构建输出。不要只覆盖一个 HTML。

重新构建（Node/npm 项目目录）：
```sh
PORTFOLIO_APP_PUBLIC_PATH=/yuanbai/ VITE_YUANBAI_PUBLIC_EDITION=true npm run build
```
上传 `dist/client/` 全部内容；`dist/server/` 为另一个托管平台适配文件，学院静态 Nginx 不使用。上面环境变量语法用于 Bash；Windows PowerShell 请分别用 `$env:变量名="值"` 设置后运行 npm。

## 通过堡垒机操作
1. 使用学院既有账号登录堡垒机，选择获授权的 Web 服务器资产。堡垒机只是登录入口，后续命令在目标服务器执行；无需提供账号、密码、令牌。
2. 确认目标服务器是 Windows 还是 Linux，以及实际 Nginx 可执行文件、运行前缀、加载的配置文件。备份现有配置和旧静态目录，记录旧版本路径，暂不覆盖。
3. 上传新版本到独立目录。将 `academy-locations.conf.example` 中两个占位符改为真实静态目录父路径与受信任 CA PEM 文件路径。Windows Nginx 配置内使用 `C:/...` 正斜杠，含空格路径需要引号。CA 文件由服务器管理员提供，不要关闭上游证书验证。
4. 在**现有学院 HTTPS server 块**添加配置片段，保留原有域名、证书、首页和其他业务。若已有 `/yuanbai/` 或 `/api/yuanbai/`，合并对应块，不能重复新增。若现有 API 是 Python，先核对旧路由是否还有其他调用方。
5. 使用同一个运行前缀与配置路径检查配置。以下参数均为占位符，替换后才运行：
```sh
<nginx-executable> -p <nginx-prefix> -c <config-path> -t
```
仅在检查成功后加载：
```sh
<nginx-executable> -p <nginx-prefix> -c <config-path> -s reload
```
Windows PowerShell 的可执行文件若为带空格路径，前置 `&` 并用引号包裹。Linux 若服务由 systemd 管理，应遵循学院既有服务管理方式。不要另外启动第二个 Nginx 实例。
6. 验证总入口、两子页、刷新和返回都正常；文字问“元白是什么”“高鹏的研究方向”；问同学应引导学院老师、不返回班级性别；手机检查排队取消、语音权限拒绝后仍能输入文字；探索游戏开局与排行榜可用。
7. 通过公众号管理员将菜单网页地址设为学院实际 HTTPS 域名下 `/yuanbai/`。真机验证 iOS/Android 微信文字、滚动、返回；语音需单独真机验收，不承诺所有微信版本均可录音。
8. 若上线异常，恢复旧配置的静态目录路径与 API 路由，先 `-t`，成功后 reload。保留新版本供排查，不删除旧版本。服务端回退可回滚对应发布提交，但旧语料行为也会回来，应在恢复公众访问前评估。

## 验证与尚缺信息
已验证生产构建、路由输出、模拟接口与公众语料测试。当前环境未进行浏览器截图、微信真机与学院真实服务器联调；这不是已上线版本。模型/排队真实服务可达性也需要部署时检查。

要生成可直接粘贴的最终配置，请提供：脱敏后的当前 Nginx `server` 块、目标系统类型、学院实际访问域名、Nginx 和网页目录路径。如要求本地 Python 后端，还需对应代码。无需任何密码或密钥。

官方 Nginx 参考：https://nginx.org/en/docs/switches.html 、https://nginx.org/en/docs/windows.html 。


## 2026-10-16 第二轮修改与联调
- 入口和对话使用黑白灰；探索页只调整外层 UI，教学关卡由游戏成员上传后再集成。
- 公众版忽略旧 YUANBAI_TTS_MODEL / YUANBAI_TTS_VOICE_ID。仅当 YUANBAI_PUBLIC_TTS_MODEL 与 YUANBAI_PUBLIC_TTS_VOICE_ID 都配置时启用合成，且禁止原定制声线 ID。未配置时语音输入仍识别，返回文字回答。旧开场录音不播放。
- 女声候选：苏瑶 Serena，试听和支持模型见 https://docs.bailian.console.aliyun.com/zh/model-studio/qwen-tts-voice-list 。该候选尚未接入；不能只替换 ID，必须确认其模型是否兼容当前 SpeechSynthesizer 接口，否则应修改调用适配。
- 对话页可展开本次检索状态与网页来源。未检索、检索无来源均明确提示；来源存在不代表已经逐条人工审核。
- 联调提问：①高鹏老师的研究方向，给官网来源；②刘亚明老师的适老化研究有哪些公开成果；③胡清清老师的研究方向，查学院官网；④学院三个研究方向是什么；⑤学院最近发布的研究成果，给日期与链接；⑥某不存在的老师研究什么。核对人物身份、成果归属、日期与链接，禁止编造。
- 当前测试为模拟服务测试，尚未验证真实模型、官网检索、女性声线、微信真机和视觉截图。请先部署到可访问的测试地址再验收，勿据此直接宣称线上功能完整。
