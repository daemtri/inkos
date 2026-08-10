# InkOS 服务器构建与启动手册（Node + pnpm）

适用环境：Alibaba Cloud Linux / CentOS 系，代码目录 `/app/inkos`，数据目录 `/data/inkos-project`。

## 1. 安装运行时

```bash
# Node 22（记忆索引依赖 node:sqlite，必须 22.5+，不要用 20）
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
yum install -y nodejs

# pnpm（Node 自带 corepack）
corepack enable
corepack prepare pnpm@latest --activate

node -v    # 应 >= 22.5
pnpm -v    # 应 >= 9
```

## 2. 安装依赖

```bash
cd /app/inkos
pnpm install
```

> 仓库的 `pnpm-workspace.yaml` 已内置 pnpm 11+ 所需的全部设置
> （`linkWorkspacePackages`、`overrides`、`onlyBuiltDependencies: [esbuild]`），
> 直接安装即可。若仍出现 `ERR_PNPM_IGNORED_BUILDS`，跑 `pnpm approve-builds` 勾选 esbuild。

安装后务必确认 workspace 链接生效（这是 core/studio 源码一致的关键）：

```bash
readlink packages/studio/node_modules/@actalk/inkos-core
# 正确：指向 ../core（workspace 软链）
# 错误：指向 .pnpm/@actalk+inkos-core@1.7.2/...（registry 副本，说明配置未生效）
```

验证锁定版本生效：

```bash
pnpm ls @mariozechner/pi-ai -r   # 应显示 0.67.1
```

若此前用旧配置装出过 registry 副本（`readlink` 指向 `.pnpm/`），需清掉重装：

```bash
rm -rf node_modules packages/*/node_modules
pnpm install
```

## 3. 构建

```bash
cd /app/inkos
pnpm build        # 依次构建 core → studio（vite 前端 + tsc 服务端）→ cli
```

如构建报 esbuild 二进制相关错误：`pnpm rebuild esbuild && pnpm build`。

构建成功标志（两个文件都存在）：

```bash
ls packages/studio/dist/index.html     # 前端产物
ls packages/studio/dist/api/index.js   # 服务端产物
```

## 4. 配置

```bash
mkdir -p /data/inkos-project
```

写入 `/app/inkos/.env`：

```bash
INKOS_LLM_PROVIDER=openai
INKOS_LLM_BASE_URL=https://api.openai.com/v1
INKOS_LLM_API_KEY=sk-你的key
INKOS_LLM_MODEL=gpt-4o

# 公网部署必须设置登录密码，否则任何人都能消耗你的 API 额度
INKOS_STUDIO_PASSWORD=你的强密码
```

## 5. systemd 常驻运行

创建 `/etc/systemd/system/inkos-studio.service`：

```ini
[Unit]
Description=InkOS Studio
After=network.target

[Service]
Type=simple
WorkingDirectory=/app/inkos
Environment=NODE_ENV=production
Environment=INKOS_STUDIO_PORT=4567
ExecStart=/usr/bin/node /app/inkos/packages/studio/dist/api/index.js /data/inkos-project
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

启动：

```bash
systemctl daemon-reload
systemctl enable --now inkos-studio
systemctl status inkos-studio     # 确认 active (running)
journalctl -u inkos-studio -f     # 实时日志
```

## 6. 放行端口

```bash
firewall-cmd --permanent --add-port=4567/tcp && firewall-cmd reload
```

并在阿里云控制台 → ECS → 安全组 → 入方向放行 4567（漏了这步外网访问不到）。

访问：`http://服务器IP:4567`

## 7.（可选）Nginx 反代 + HTTPS

```nginx
server {
    listen 443 ssl;
    server_name inkos.你的域名.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4567;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 写作是 SSE 长连接：关缓冲、放长超时
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

配置后安全组只需开放 443，4567 可收回。

## 8. 日常运维

```bash
# 更新代码
cd /app/inkos
git pull
pnpm install
pnpm build
systemctl restart inkos-studio

# 数据备份（所有书稿、设定、会话都在数据目录）
tar czf inkos-backup-$(date +%F).tar.gz -C /data inkos-project
```

## 注意事项

- 必须设置 `INKOS_STUDIO_PASSWORD`。
- 数据目录与代码目录分离，更新代码不影响书稿数据。
- 升级代码版本后务必重新 `pnpm install && pnpm build` 再重启，前后端产物必须配套。
- 生产运行用 Node 即可；若想用 Bun（Linux ≥ 1.2）跑产物亦可：
  `INKOS_STUDIO_PORT=4567 bun packages/studio/dist/api/index.js /data/inkos-project`，
  但构建链仍走 Node + pnpm。
