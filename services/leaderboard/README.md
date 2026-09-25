# 元白探索 · 自托管排行榜

游戏前端仍在 `https://apps-demo.muyang23333.top/yuanbai/explore/`，**这个目录里的后端运行在自己的云服务器**。接口为 `https://123.56.162.88/api/yuanbai/game/{runs,finish,scores,leaderboard}`；不需要修改 `portfolio-app-demos`。只有通关且服务器回放成功后才能提交昵称。每名玩家每个规则版本只保留最佳成绩，按坠落次数、用时、步数依次升序排名。浏览器将服务器签发的随机身份令牌存在当前浏览器的 localStorage；换浏览器不继承身份。

数据库为服务器磁盘 `/var/lib/yuanbai/leaderboard.sqlite`（SQLite WAL 还会生成 `-wal` 和 `-shm` 文件）。游戏源码、数据库和私钥分别存放；**SSH 私钥不要上传到 GitHub、网页或聊天窗口**。当前设计不自动迁移旧排行榜数据；历史榜单需要单独导入旧数据。

## 在能连接服务器的电脑上部署

先在 Windows PowerShell 中试连接。把 `<登录名>` 换成服务器实例提供的用户名（常见为 `root` 或 `ubuntu`）。桌面上的私钥只供本机 SSH 使用：

```powershell
ssh -i "$env:USERPROFILE\Desktop\id_rsa" <登录名>@123.56.162.88
```

如果连接超时，先在云服务商安全组放行 TCP 22、80、443，并检查服务器防火墙。**只放行 80/443 给公网**；Node 服务始终监听本机 `127.0.0.1:4174`。若提示 `Permission denied`，请确认登录名和密钥是否与该服务器匹配。

登录后确保服务器是 Linux、有 nginx，安装 Node.js **24 或更高版本**和 Git。确认 `node --version`、`nginx -v`、`sudo -v`；并在仓库 PR 经另一位成员审阅合并后执行（若仓库在 GitHub 上为私有仓库，还需配置只读拉取权限）：

```bash
sudo git clone https://github.com/akdddddcccc/yuanbai_agent.git /opt/yuanbai_agent
sudo useradd --system --no-create-home --shell /usr/sbin/nologin yuanbai
sudo install -d -m 750 -o yuanbai -g yuanbai /var/lib/yuanbai
sudo cp /opt/yuanbai_agent/services/leaderboard/deploy/yuanbai-leaderboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now yuanbai-leaderboard
curl --fail http://127.0.0.1:4174/health
```

如 `yuanbai` 系统用户已存在，就跳过 `useradd`。重启时数据库留在 `/var/lib/yuanbai/`；更新源码可在 `/opt/yuanbai_agent` 执行 `sudo git pull --ff-only`，然后 `sudo systemctl restart yuanbai-leaderboard`。上线前备份数据库时同时备份 WAL 文件，或先 `sudo systemctl stop yuanbai-leaderboard` 再复制 `.sqlite` 文件并重启。

## 在 IP 上启用 HTTPS

游戏页面本身是 HTTPS，连接 IP 接口也必须有浏览器信任的 HTTPS 证书。Let's Encrypt 目前能给公网 IP 签发证书，需要 Certbot **5.4 或更高版本**；IP 证书仅有效 **6 天**，要自动续期。请先在服务器现有 **80 端口 nginx 配置**对应的 `server` 块添加下面这一段，不要直接覆盖已有网站：

```nginx
location ^~ /.well-known/acme-challenge/ {
    root /var/www/letsencrypt;
    default_type text/plain;
}
```

创建目录 `sudo mkdir -p /var/www/letsencrypt/.well-known/acme-challenge/` 后运行 `sudo nginx -t && sudo systemctl reload nginx`。可写入临时测试文件，再从外网请求 `http://123.56.162.88/.well-known/acme-challenge/文件名`，确认它能返回内容，然后删除测试文件。根据服务器系统安装新版 Certbot 并先用 staging 验证，成功后正式申请：

```bash
sudo certbot certonly --staging --cert-name yuanbai-ip-staging --preferred-profile shortlived --webroot --webroot-path /var/www/letsencrypt --ip-address 123.56.162.88
sudo certbot certonly --preferred-profile shortlived --webroot --webroot-path /var/www/letsencrypt --ip-address 123.56.162.88
sudo certbot certificates
```

staging 使用单独证书名；**启用 nginx 443 前确认 `certbot certificates` 列出的正式证书不是 staging**。将 `deploy/nginx-ip-https.conf` 复制到 nginx `http` 配置下的 `conf.d/`，例如：

```bash
sudo cp /opt/yuanbai_agent/services/leaderboard/deploy/nginx-ip-https.conf /etc/nginx/conf.d/yuanbai-leaderboard.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot reconfigure --cert-name 123.56.162.88 --deploy-hook 'systemctl reload nginx'
sudo certbot renew --dry-run
```

核对 Certbot 自动续期任务已启用：`systemctl list-timers --all | grep -E 'certbot|snap.certbot'`；若没有定时任务，按服务器的 Certbot 安装方式启用续期定时器。确保云安全组与防火墙均已放行 443。Certbot 目前**不会自动把 IP 证书装进 nginx**，因此上述手动配置和续期重载不可省略。

## 上线检查

1. `curl --fail https://123.56.162.88/health` 返回 `{"ok":true}`，无 `-k` 参数。
2. 打开游戏，读取当前榜单，开始一次探索；确认状态不是「练习模式」。
3. 通关后输入昵称，刷新页面仍能在排行榜看到成绩；另一台设备能看到同一排行榜。
4. `sudo systemctl status yuanbai-leaderboard` 显示 active；定期把 `/var/lib/yuanbai` 安全备份到服务器之外。

本地验证：仓库根目录执行 `node --test services/leaderboard/test/server.test.mjs` 和 `npm ci && npm run build`。
