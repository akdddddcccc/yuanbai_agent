# 学院独立后端：排行榜分流与 Agent

此包放到 D:\yuanbai\backend。现有网页继续在 D:\yuanbai\public；不修改个人站、APP demo、旧数据库或其他业务。无需安装 npm 依赖，需 Node.js 24 或更高。先在 PowerShell 执行 node --version；若找不到，请安装 Node 24 或将便携 node.exe 加入 PATH。

## 1. 恢复历史数据到独立学校排行榜

```powershell
Set-Location D:\yuanbai\backend
powershell -NoProfile -ExecutionPolicy Bypass -File .\Restore-History.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Leaderboard.ps1
```

本包自带 2026-10-17 16:32:09 的历史快照：普通榜21条、死亡榜21条、昵称归属21条、游戏记录428条。已验证规则 yuanbai-v5-san 兼容。恢复脚本校验文件并拒绝覆盖任何已存在的学校数据库（包括空库）。若报目标已存在，请停止操作，不要删除数据库。前台启动窗口保持打开，在另一个 PowerShell 中检查：

```powershell
curl.exe --noproxy "*" http://127.0.0.1:4174/health
```

确认返回 ok，再关闭前台服务（Ctrl+C）。管理员 PowerShell 执行：

```powershell
Set-Location D:\yuanbai\backend
powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-LeaderboardTask.ps1
Get-ScheduledTask -TaskName YuanbaiSchoolLeaderboard
```

计划任务开机启动，仅监听本机 4174，不需要对外开放这个端口。学校来源已按现有 HTTP/HTTPS 域名配置，个人站来源不在白名单中。

## 2. 修改现有 Nginx

备份当前实际使用的 nginx.conf。仅将原来的 `location ^~ /api/yuanbai/game/ { ... }` 整块替换为本包 nginx-leaderboard.conf 的内容。删除的只是这块原有个人站反向代理，包括旧的 Origin 重写和上游 CA 配置。保留 /yuanbai/ 静态映射、/api/、/videoSys、/ftp 等全部其他配置。

在确认当前 Nginx 使用以下安装目录后运行（若实际使用了其他 -p/-c 参数，必须沿用）：

```powershell
Set-Location D:\nginx\nginx-1.30.4
.\nginx.exe -t
if ($LASTEXITCODE -eq 0) { .\nginx.exe -s reload }
```

浏览器刷新学校游戏，新开一局并完成后检查正常榜和死亡榜。个人站的排行榜应保持不变。恢复后双榜应各有21条。快照导出之后个人站新增成绩不包含在内；切换后两边独立更新。

## 3. 可选的后续名单导入（本次不要执行）

history-template.json 是字段示例，不是真实成绩，请勿原样导入。提供普通榜和死亡榜的完整导出，包含昵称、坠落次数、用时、步数、完成时间；截图或 Excel 可先交给助手转换。缺失的数据不能凭空补齐。只导出前 20 名不能恢复榜单后面的记录。规则版本不一致时需另行确认，导入器不会强行混榜。

每条记录 sourceId 必须稳定，重导出仍使用相同 ID。board 为 best 或 deaths；durationMs 是毫秒，completedAt 是 Unix 毫秒时间。脚本默认预检，--apply 才写入，写入前自动产生 SQLite 一致备份。重复导入不重复计数；同 ID 内容不同则报错，不覆盖已有成绩。应用导入前停止学校排行榜服务，导入后重启：

```powershell
Set-Location D:\yuanbai\backend
Stop-ScheduledTask -TaskName YuanbaiSchoolLeaderboard
node .\services\leaderboard\import-history.mjs .\data\school-leaderboard.sqlite .\history.json
# 预检成功且数量正确后运行：
node .\services\leaderboard\import-history.mjs .\data\school-leaderboard.sqlite .\history.json --apply
Start-ScheduledTask -TaskName YuanbaiSchoolLeaderboard
```

名单导入保留历史排名，作为独立历史身份，不占用新玩家昵称、不恢复原玩家凭据。新玩家同名成绩可能与历史成绩并列，不能自动断言是同一个人。若需要原玩家继续更新原成绩，请提供完整数据库及对应身份迁移方案；不要通过昵称自动绑定。现有客户端的学院身份与个人身份已独立。

## 4. Agent（单独部署，不随排行榜切换自动启用）

agent/server.mjs 已包含学院语料库、官网来源检索逻辑、女性音色 Serena 和语音排队。复制 agent/agent-config.example.json 为 agent/agent-config.json，只在服务器填写 DeepSeek 与百炼密钥。配置存于 public 目录之外。学校本机部署不自动读取 EdgeOne 环境变量。

```powershell
Set-Location D:\yuanbai\backend
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\Start-Agent.ps1
```

另一个窗口检查 http://127.0.0.1:4175/health。实际文字问答及语音成功后，停止前台服务，再由管理员运行 deploy/Install-AgentTask.ps1。将 nginx-agent.conf 中的几个 location 加到现有学校 server 内，不能与旧规则重复，执行 nginx -t 后再 reload。它们不会改动排行榜。

此 Agent 是学校本机运行版本；本包不会自动更新 EdgeOne 云端 Agent。如果暂不将密钥放学校，先不要添加 Agent Nginx 配置，排行榜可独立部署。最终 Agent 承载位置仍需对学校到模型服务的实际延迟做对比后确定，不能保证尚未实测的网络速度。

## 5. 验收和回滚

完成学校真实网络、手机及公众号环境访问测试，再转发。HTTP 可以显示网页及文字问答，但麦克风通常需要安全的 HTTPS 上下文；当前 Windows 未监听 443，需要核实学校 TLS 网关或配置证书后才能验收语音。内网地址不等于校外可达。

数据库位于 backend/data，不在网页目录；更新前端不会删除它。回滚排行榜路由时恢复备份的 Nginx 对应块并检验、重载；学校新成绩留在学校库，不自动回传个人站。勿覆盖或删除新成绩库。

## 玩家身份说明

已完整保留原数据库 player_id 和昵称归属，但学院域名与个人站浏览器凭据不共享。老玩家首次进入学院站可能得到新身份，旧昵称会提示已占用；历史成绩仍正常显示。不要按昵称自动合并身份或删除昵称归属。身份迁移如有需要，另行设计验证流程。

本包不含运行中的 data 数据库，只有 snapshot 快照。解压不会直接覆盖学校成绩；只有 Restore-History.ps1 创建新库。包内 public/explore/core.js 是后端校验规则，留在 backend 内，勿替换网页目录。
