# Phase 3B：自有服务器后端

CloudBase 不再作为生产主路径。正式架构调整为：

`微信小程序 → HTTPS API → 自有服务器 → PostgreSQL + MinIO + Qwen3.8-Flash`

## 已加入

- `server/`：Fastify + TypeScript API
- PostgreSQL / Prisma 数据模型
- MinIO 原始发货单对象存储
- 原图 SHA-256
- `qwen3.8-flash` 多模态 Provider
- JSON Schema 严格结构化输出
- 第一轮图片识别
- 历史商品候选检索
- 第二轮带候选复核
- 数量字段必须优先依赖当前图片
- 程序计算 `cartons × unitsPerCarton`
- AI 字段证据持久化
- 自动 / AI复核 / 人工复核状态
- Docker Compose 本地/服务器部署骨架

## API

### 上传原始单据

`POST /api/v1/files/upload`

使用 `multipart/form-data`，字段名 `file`。原始文件写入 MinIO 的 `original/YYYY/MM/DD/...`，不会被增强图覆盖。

### 发起识别

`POST /api/v1/recognitions`

```json
{
  "sourceFileIds": ["...", "..."]
}
```

同一数组中的图片视为同一张发货单。

### 获取台账

- `GET /api/v1/shipments`
- `GET /api/v1/shipments/:id`

### 获取原图临时地址

`GET /api/v1/files/:id/url`

返回短时效 MinIO 签名地址，不把存储桶直接公开。

## Qwen

服务端使用阿里云百炼 OpenAI 兼容接口。环境变量：

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL`
- `QWEN_MODEL=qwen3.8-flash`

真实 API Key 永远只存在服务器环境变量中，不进入微信小程序、不进入 GitHub。

识别原则：

1. 第一轮只看当前图片。
2. 根据第一轮 SKU / 商品名 / 规格 / 颜色检索最多 8 个历史候选。
3. 第二轮把原图、第一轮结果、候选商品一起给 Qwen。
4. 历史信息可以修正商品身份，但不能覆盖本次箱数、日期、单号。
5. 如果交易数字无法视觉确认，进入人工复核。

## Docker 启动

服务器安装 Docker / Docker Compose 后：

```bash
export POSTGRES_PASSWORD='请换成长随机密码'
export MINIO_ACCESS_KEY='请换掉默认值'
export MINIO_SECRET_KEY='请换成长随机密码'
export DASHSCOPE_API_KEY='sk-...'
export DASHSCOPE_BASE_URL='https://YOUR_WORKSPACE_ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'

docker compose up -d --build
```

检查：

```bash
curl http://127.0.0.1:3000/health
```

生产环境下一步还需要：

- 域名
- HTTPS 证书
- Nginx / Caddy 反向代理
- 微信小程序 request / uploadFile 合法域名
- PostgreSQL 自动备份
- MinIO 原图异机/异地备份
- API 登录鉴权

## 当前边界

本提交先完成“服务器基础设施 + 真实 AI 管线”的代码骨架。完整数据库导出、Excel、重复单据检测、字段局部裁图复识、后台管理页面将在后续阶段实现。
