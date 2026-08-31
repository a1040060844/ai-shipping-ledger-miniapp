# Ubuntu 24 bare-metal deployment

本目录用于 Ubuntu 24 生产部署，不依赖 Docker。

## 生产组件

- Node.js 22 + Fastify API
- PostgreSQL（Ubuntu 24 apt 版本）
- MinIO Server + `mc`
- Nginx
- Certbot（若目标域名尚无有效 HTTPS）
- systemd

服务约束：

- API：`127.0.0.1:3000`
- PostgreSQL：仅本机
- MinIO API：`127.0.0.1:9000`
- MinIO Console：`127.0.0.1:9001`
- 公网只开放 Nginx 的 80/443

## 1. DNS

部署前确认目标域名已经解析到该服务器公网 IP。

如果这个域名已经承载其他网站，不要覆盖原 Nginx 配置。本项目默认挂在：

`/shipping-ledger-api/`

因此可以和已有站点共用同一个域名。

## 2. 准备秘密变量

在服务器 shell 中设置，禁止写入 Git：

```bash
export DOMAIN='your-domain.example.com'
export DASHSCOPE_API_KEY='sk-...'
export DASHSCOPE_BASE_URL='https://YOUR_WORKSPACE_ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'
```

`bootstrap.sh` 会自动生成 PostgreSQL 与 MinIO 的随机密码并写入 `/etc/ai-shipping-ledger/`，权限为 root-only。

## 3. 安装系统依赖

```bash
sudo -E ./deploy/ubuntu24/bootstrap.sh
```

脚本会安装/配置：

- Node.js 22
- PostgreSQL
- Nginx / Certbot
- MinIO / mc
- 独立 Linux service users
- PostgreSQL database/user
- MinIO bucket（private + versioning）
- systemd service 文件
- 每日数据库/对象存储备份 timer

## 4. 发布 API

```bash
sudo -E ./deploy/ubuntu24/deploy-app.sh
```

代码安装位置：

`/opt/ai-shipping-ledger/server`

运行环境：

`/etc/ai-shipping-ledger/server.env`

## 5. Nginx

部署脚本会安装 location snippet：

`/etc/nginx/snippets/ai-shipping-ledger-location.conf`

如果域名已有网站，在该域名 HTTPS `server {}` 内增加：

```nginx
include /etc/nginx/snippets/ai-shipping-ledger-location.conf;
```

然后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

如果域名当前没有 HTTPS vhost，可由 Codex 根据服务器现状创建；不要让自动脚本盲目覆盖现有 vhost。

若还没有证书：

```bash
sudo certbot --nginx -d "$DOMAIN"
```

## 6. 验证

```bash
sudo -E ./deploy/ubuntu24/verify.sh
```

应通过：

- PostgreSQL active
- MinIO active/ready
- API active
- Nginx active
- `http://127.0.0.1:3000/health`
- `https://$DOMAIN/shipping-ledger-api/health`

## 7. 小程序切生产 API

公网 HTTPS 验证通过后，才把 `miniprogram/config.js` 改成：

```js
module.exports = {
  BACKEND_MODE: 'server',
  API_BASE_URL: 'https://your-domain.example.com/shipping-ledger-api'
}
```

同时在微信公众平台配置该 HTTPS 域名为 request / uploadFile 合法域名。

## 数据目录

- PostgreSQL：系统默认 PostgreSQL 数据目录
- MinIO：`/var/lib/ai-shipping-ledger/minio`
- 备份：`/var/backups/ai-shipping-ledger`
- 应用：`/opt/ai-shipping-ledger/server`
- Secrets：`/etc/ai-shipping-ledger/*.env`

## 安全原则

- MinIO bucket 永不 public。
- 3000/5432/9000/9001 不对公网监听。
- Git 中不出现生产密码/API Key。
- 原始发货单 object key 只新增，不覆盖。
- Nginx 修改前必须备份并 `nginx -t`。
- 当前本机备份不是异地备份；上线后仍需要增加第二份异机/对象存储备份。