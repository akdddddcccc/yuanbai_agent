# 元白学院整合版 v7：Windows 堡垒机部署

本包在朋友上传的 v6 上整合9月28日汇报版双入口、互动教学、新知识库和女声Agent。堡垒机是远程入口，以下操作都在其中打开的目标Windows服务器进行。无需在服务器安装Git或运行前端构建；需要Node.js 24+。现有游戏排行榜继续使用现场服务，不迁库、不启动包外的排行榜示例。

## 1. 把包送到服务器

下载并解压本包。通过学院允许的文件传输方式送入目标Windows：如果堡垒机没有上传功能，在远程Windows浏览器访问你有权限的下载位置并下载；也可请管理员放入指定目录。不要把API密钥放进网盘公开链接。

最终目录必须是：

- `D:\yuanbai\releases\v7\public\index.html`（网页）
- `D:\yuanbai\releases\v7\agent\server.mjs`（已打包后端）
- `D:\yuanbai\releases\v7\agent\agent-config.example.json`
- `D:\yuanbai\releases\v7\deploy\yuanbai-locations.conf`

不要多套一层同名文件夹。不要覆盖 `D:\yuanbai\public`；它是回滚用的v6网页。更不要覆盖原来的数据库或排行榜服务。

在PowerShell校验解压后的文件：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\yuanbai\releases\v7\deploy\Verify-Package.ps1
node --version
```

这里的Bypass仅适用于本次脚本进程，不修改系统执行策略。检查脚本内容后执行。Node版本不足时从 https://nodejs.org/ 安装Node.js 24 LTS，或使用管理员提供的便携版本并将node.exe加入该会话PATH。

## 2. 设置Agent（只在服务器填写密钥）

将 `agent-config.example.json` 复制为同目录 `agent-config.json`，用记事本填写：

| 字段 | 设置 |
| --- | --- |
| DASHSCOPE_API_KEY | 阿里云百炼北京地域可调用模型的密钥 |
| DEEPSEEK_API_KEY | 现有DeepSeek密钥 |
| YUANBAI_ALLOWED_ORIGINS | 保留学院实际HTTP/HTTPS来源；域名必须准确，不带路径或末尾斜杠 |
| YUANBAI_PUBLIC_TTS_MODEL | 默认 `qwen3-tts-flash` |
| YUANBAI_PUBLIC_TTS_VOICE_ID | 默认 `Serena`，官方系统女声“苏瑶” |
| YUANBAI_ASR_MODEL | 默认 `qwen3-asr-flash` |
| PORT | 默认 `4175`；若冲突，同时修改Nginx配置中的4175 |

如果百炼账号要求工作空间专属域名，将 `DASHSCOPE_BASE_URL` 改为控制台给出的北京地域完整HTTPS主机地址（不带 `/api/v1`）。新加坡密钥不能混用北京地址。当前适配器仅核对了Qwen3录音识别与Qwen3非实时TTS协议，不能随意改成旧CosyVoice或其他模型。旧院长音色ID被明确拦截，旧开场录音不随包发布。

配置文件在 `public` 之外，Nginx只映射public。请将其NTFS读取权限限制给管理员与实际运行Agent的账户；不要提交Git或发到聊天。启动：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\yuanbai\releases\v7\deploy\Start-Agent.ps1
```

另开一个PowerShell窗口：

```powershell
Invoke-RestMethod http://127.0.0.1:4175/health
```

应显示 `ok: true`、`configured: true`、`voice: Serena`。这只证明服务启动和配置字段存在，不证明密钥有效；实际模型调用在第5步验收。

前台窗口关闭会停止服务。确认成功后Ctrl+C结束前台服务，然后在**管理员PowerShell**运行以下脚本，注册开机启动的独立计划任务：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\yuanbai\releases\v7\deploy\Install-AgentTask.ps1
Get-ScheduledTaskInfo -TaskName YuanbaiSchoolAgentV7
Invoke-RestMethod http://127.0.0.1:4175/health
```

无管理员权限时，请管理员完成这一步。不要同时运行两个实例。任务默认SYSTEM身份，Node和配置文件必须位于本机磁盘且可被该身份读取。本服务只监听127.0.0.1，不需要对外开放4175端口。

## 3. 找到正在运行的Nginx，备份配置

```powershell
Get-CimInstance Win32_Process -Filter "name='nginx.exe'" | Select-Object ExecutablePath,CommandLine
```

记录现有Nginx运行目录、`-p`前缀和`-c`配置路径。若CommandLine没有这些参数，请按现有启动脚本确认，不能只凭exe所在位置猜测。把实际配置文件复制为带日期的备份，同时记录旧 `/yuanbai/` 和 `/api/yuanbai/chat`、`voice-queue` 的location内容。

## 4. 合并Nginx location（不要替换整个nginx.conf）

本包 `deploy/yuanbai-locations.conf` 已使用已知Windows部署目录。将其合入学院域名对应的**现有 `server {}` 内部**。可以使用：

```nginx
include D:/yuanbai/releases/v7/deploy/yuanbai-locations.conf;
```

使用include前，移除或替换旧的同名 `/yuanbai/`、`/api/yuanbai/chat`、`/api/yuanbai/voice-queue/` location，避免重复或旧 `^~` 抢先匹配。**保留现有 `/api/yuanbai/game/` location原样**，不要改旧Python或排行榜的端口。若已有覆盖全部API的精确/正则location，按Nginx匹配规则排除这两个新增API，切勿顺手改其它业务。

片段的作用是：网页映射至 `D:/yuanbai/releases/v7/public/`，聊天和排队反代至 `127.0.0.1:4175`。新的本地Agent不依赖EdgeOne PR合并，不需要将EdgeOne密钥放入网页。

确保既有 `http {}` 已加载 `include mime.types;`，使.js/.css按正确MIME发送。维持原有域名、监听端口、证书和其他学院站点。

使用实际路径执行（下面的D:\nginx是示例，必须按第3步修改）：

```powershell
$nginxDir = 'D:\nginx' # 改为实际运行前缀
$nginxExe = Join-Path $nginxDir 'nginx.exe' # 如exe不在这里，填实际路径
$configPath = 'conf/nginx.conf' # 按现有-c参数修改
& $nginxExe -p ($nginxDir + '\') -c $configPath -t
# 只有上一条显示syntax is ok且test is successful，才执行：
& $nginxExe -p ($nginxDir + '\') -c $configPath -s reload
```

不要执行不带参数的nginx.exe另起实例。若是Nginx服务管理器托管，按现场服务管理方式reload。

### HTTPS与微信语音

朋友的v6记录是 `http://oa.design.bnuzh.edu.cn`。HTTP上页面、游戏和文字提问可以使用，但浏览器通常不开放麦克风。要在手机/微信使用录音，必须由学院管理员启用该域名的可信HTTPS证书，或确认现有HTTPS网关已正确转发；不能靠改一个前端选项解决，也不要绕过证书警告。

如果已有HTTPS `server`，把同一个location片段合入该块，保留其现有证书。若HTTPS在上级网关终止，由管理员把 `/yuanbai/`、`/api/yuanbai/chat`、`/api/yuanbai/voice-queue/` 一起转发到此Nginx；不能只转静态页面。确认HTTPS可用后，再把公众号菜单指向 `https://oa.design.bnuzh.edu.cn/yuanbai/`。已有 `/yuanbai/explore/` 菜单链接仍显示首页，兼容保留。

## 5. 验收（上线前逐条走一遍）

1. 打开 `/yuanbai/`，看到原汇报版模型、探索和对话双入口；刷新 `/yuanbai/dialogue/` 可直接打开。
2. 首次从首页点探索：先规则介绍，再4×4教学，完成或跳过进入9×9正式游戏。旧玩家可在“探索规则”中重看教学；教学不提交成绩。
3. 文字问“胡清清研究什么”“刘亚明的AI人格反馈论文有哪些限制”，展开来源。应识别教师，明确证据边界。
4. 问“查一下胡清清老师的官网介绍”：应显示实际官网读取结果；若官网连接失败，状态应如实提示。未收录人物或开放网络搜索仍依赖模型提供商的联网接口能力，未返回来源时不能宣称检索成功。
5. HTTPS手机真机允许麦克风，短句询问，核对识别文字、Serena女声、模型动画、停止回答、排队取消。iOS和Android微信各测一次。女声未试听验收；如不合适，可在同模型支持的系统音色中更换voice参数。
6. 正式游戏开局、存取现有排行榜。该服务继续沿用现场后端，本包不迁移或覆盖历史成绩。
7. 模拟拒绝麦克风时仍能文字提问；声音服务故障时已生成的文字回答仍保留；并发或快速连续请求不会永久占用队列。

## 6. 回滚与排错

页面出问题：恢复第3步备份的location，使静态目录回到 `D:/yuanbai/public`；恢复原聊天/排队代理；`-t`通过后reload。旧目录始终未被本包覆盖。

停止新Agent：`Stop-ScheduledTask -TaskName YuanbaiSchoolAgentV7`；如不再使用，可 `Disable-ScheduledTask -TaskName YuanbaiSchoolAgentV7`。不要停原排行榜任务。

- 502：检查4175的health、计划任务是否运行、Nginx上游端口。
- 403：检查地址栏origin与配置白名单完全相同；反代保留真实Origin。
- 503“密钥尚未配置”：检查服务端配置，重启新Agent任务；不要改前端。
- 文字成功但无声音：查看页面的声音状态，核对百炼余额、模型权限、地域和音色。
- 手机无录音权限：先检查HTTPS可信证书，再检查微信/系统麦克风权限。
- 模型空白：检查models与model-preload.js是否齐全、GLB请求是否200、浏览器WebGL是否可用。

现场Nginx配置、证书和真实密钥未提供，本包不能代替这些现场配置，也没有宣称已在学院服务器运行。

参考： https://nginx.org/en/docs/windows.html 、 https://nginx.org/en/docs/switches.html 、 https://help.aliyun.com/zh/model-studio/qwen-tts-api 、 https://help.aliyun.com/zh/model-studio/qwen-tts-voice-list 、 https://help.aliyun.com/zh/model-studio/qwen-asr-api-reference 。
