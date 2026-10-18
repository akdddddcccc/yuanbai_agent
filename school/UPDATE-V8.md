# 学校版 V8 更新

沿用分支 school/integrated-agent-v7-20261017，禁止合并或部署到个人 main。

## 已改
- 对话模型只精简白色金属细节；主体轮廓、玻璃、红砖及重要空洞保留。
- 模型实际下载由 18.65 MB / 28 分块改成 1.63 MB / 1 文件。
- 15 个可运动楼体及连接件绑定保留；模型内存大小 7.42 MB。
- 首页先显示导航，三维代码动态加载；主入口约 208 KB，原来约 916 KB。
- 文字输入后先显示回答，服务器异步生成现有配置中的女声（学校配置 Serena）。
- 自动播放失败显示播放按钮，播放结束可重播。保持删除录音按钮。
- 声音超时/失败不删除文字答案。声音队列独立限额，过期票据不能再次合成任意文本。
- 语音轮询仍用 /api/yuanbai/chat，无需修改已修好的 Nginx location。
- 所有生成资源均不从 CDN 获取，原知识库、新手教学和排行榜代码保留。

## 服务器更新
先在自己的电脑 fetch GitHub 并从最新远程分支生成 bundle，然后传到 D:\yuanbai\yuanbai-school.bundle。
服务器：

```powershell
$ErrorActionPreference = 'Stop'
Set-Location D:\yuanbai\source
if (git status --porcelain) { throw 'Source has local changes; inspect before updating.' }
git fetch D:\yuanbai\yuanbai-school.bundle refs/remotes/origin/school/integrated-agent-v7-20261017
if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed' }
git merge --ff-only FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw 'Fast-forward failed' }
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\school\Deploy-School.ps1
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed; read the error and rollback messages above.' }
```

Deploy-School.ps1 先构建，然后备份 public 和旧 server.mjs，先复制资源，再重启现有 YuanbaiSchoolAgentV7 任务并验健康，最后更新 HTML。
不覆盖 agent-config.json，不复制/清空任何数据库，不改排行榜服务，不更改 Nginx 或计划任务定义。
失败自动尝试恢复旧 Agent 和旧页面；备份路径会显示。新增哈希资源保留，不删除旧资源。
需要管理员 PowerShell、现有 Node 24+、Git 和已安装的 Agent 计划任务。已有 node_modules 时不重新联网安装。

## 验收与边界
1. health 应显示 edition=school-v8、speech_async=true。
2. 网页输入问题后先看到文字；随后听到女声或出现播放按钮；结束后可以重播。
3. 停止回答/返回首页后，不应继续播放旧声音。
4. 对话模型加载完成后检查楼体轮廓及说话时的浮动；首次教学和游戏仍可进入。
5. 本地构建、Agent mock、模型解码/分组/非金属几何一致性、学校与排行榜测试通过。
6. 此环境不能访问本地浏览器预览，也没有 Windows PowerShell；微信真实音频权限和学校机器上的部署脚本需现场验收，不能宣称已验证。
7. 本版未做全立面贴图烘焙，使用更保守的局部减面。已做三个视角的离线对比。
8. Nginx 双主进程问题仍需现场整理。本脚本不发 reload，避免再次影响学校其他网站。
