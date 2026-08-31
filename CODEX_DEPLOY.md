# Codex deployment runbook — Ubuntu 24 bare metal

目标：把本仓库部署到 Ubuntu 24 服务器，不使用 Docker。

生产架构：

`微信小程序 -> HTTPS /shipping-ledger-api -> Nginx -> Fastify(127.0.0.1:3000) -> PostgreSQL + MinIO + Qwen3.8-Flash`

## Codex 执行原则

1. 先读取 `deploy/ubuntu24/README.md`，再执行任何系统修改。
2. 不得把任何密码、数据库口令、MinIO Secret、DashScope API Key 写回 Git。
3. 不得覆盖服务器上已有网站。若目标域名已有 Nginx vhost，只在其 HTTPS `server {}` 中加入：
   `include /etc/nginx/snippets/ai-shipping-ledger-location.conf;`
4. 修改 Nginx 后必须先 `nginx -t`，成功后才能 reload。
5. PostgreSQL、MinIO、Fastify API 只监听本机，不向公网直接暴露 3000/5432/9000/9001。
6. 原始发货单存储桶不得设为 public。
7. 部署完成后运行 `deploy/ubuntu24/verify.sh`。所有核心检查通过后，才把小程序 `BACKEND_MODE` 切成 `server`。

## Codex 需要从部署环境获得的变量

不要写进仓库：

```bash
export DOMAIN='<用户提供的域名>'
export DASHSCOPE_API_KEY='<真实 Key>'
export DASHSCOPE_BASE_URL='<百炼 OpenAI 兼容接口 base url>'
```

可选：

```bash
export API_PREFIX='/shipping-ledger-api'
```

## 推荐执行顺序

在服务器上：

```bash
git clone https://github.com/a1040060844/ai-shipping-ledger-miniapp.git
cd ai-shipping-ledger-miniapp

sudo -E ./deploy/ubuntu24/bootstrap.sh
sudo -E ./deploy/ubuntu24/deploy-app.sh
```

然后按 `deploy/ubuntu24/README.md` 把 Nginx location snippet 加入目标域名现有 HTTPS vhost；若该域名尚无 vhost，则创建标准 HTTPS vhost，但不要猜测或覆盖已有站点。

验证：

```bash
sudo -E ./deploy/ubuntu24/verify.sh
```

预期公网健康检查：

```text
https://<DOMAIN>/shipping-ledger-api/health
```

## 验证通过后的最后一步

修改：

`miniprogram/config.js`

为：

```js
module.exports = {
  BACKEND_MODE: 'server',
  API_BASE_URL: 'https://<DOMAIN>/shipping-ledger-api'
}
```

然后提交一个独立 commit，例如：

```text
chore: point mini program to production API
```

不要在后端未通过公网 HTTPS 健康检查前提前切换。