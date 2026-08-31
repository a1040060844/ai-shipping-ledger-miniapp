# AI Shipping Ledger Mini Program

面向香皂发货业务的 AI 发货台账微信小程序。

核心目标不是“OCR 转文字”，而是：原始发货单永久保存、AI 多级复核、只有真正无法确定的字段才人工介入，并把最终数据沉淀成可统计、可追溯、可完整导出的数据库。

## 当前正式架构

```text
微信小程序
   ↓ HTTPS
自有 API 服务器（Fastify + TypeScript）
   ├─ PostgreSQL：发货台账 / 产品库 / 工厂库 / AI证据 / 修改记录
   ├─ MinIO：原始发货单对象存储
   └─ Qwen3.8-Flash：图片识别 + 历史商品候选复核
```

CloudBase 不再作为生产主路径。仓库中此前的云函数代码仅属于早期实验阶段，后续以 `server/` 为准。

## 已完成

### Phase 1 — 数据模型

- Shipment / ShipmentItem
- Product / Factory / FactoryProductAlias
- SourceFile 原始证据
- FieldEvidence AI字段证据
- AuditLog 修改记录
- 同 SKU 原始明细保留 + 统计汇总
- 总件数由程序确定性计算

### Phase 2 — 微信小程序原型

- 首页
- 拍照 / 相册 / PDF 上传
- 多图属于同一张发货单
- 发货详情编辑
- 自动保存
- 台账列表
- 原图查看
- Mock 模式可在没有服务器时继续演示

### Phase 3A — Qwen 识别规则

- `qwen3.8-flash`
- 严格结构化结果
- 产品候选检索
- AI 二次复核
- AUTO_ACCEPT / AI_REVIEW / HUMAN_REVIEW
- 交易数字不能被历史记录覆盖

### Phase 3B — 自有服务器基础设施

- `server/` Fastify + TypeScript
- PostgreSQL + Prisma
- MinIO 原图存储
- SHA-256 文件指纹
- `/api/v1/files/upload`
- `/api/v1/recognitions`
- `/api/v1/shipments`
- `/api/v1/files/:id/url`
- Qwen OpenAI 兼容 Provider
- 第一遍视觉识别 → 历史候选 → 第二遍复核
- Docker Compose 部署
- 小程序 Server API 适配器

详见 `docs/04-self-hosted-backend.md`。

## 本地 / 服务器启动

```bash
export POSTGRES_PASSWORD='replace-me'
export MINIO_ACCESS_KEY='replace-me'
export MINIO_SECRET_KEY='replace-me-with-a-long-password'
export DASHSCOPE_API_KEY='sk-...'
export DASHSCOPE_BASE_URL='https://YOUR_WORKSPACE_ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'

docker compose up -d --build
```

健康检查：

```bash
curl http://127.0.0.1:3000/health
```

## 小程序切换到真实服务器

编辑 `miniprogram/config.js`：

```js
module.exports = {
  BACKEND_MODE: 'server',
  API_BASE_URL: 'https://你的API域名'
}
```

正式微信小程序必须使用 HTTPS，并把 API 域名配置为微信小程序合法域名。

## 数据原则

1. 原始图片只新增，不覆盖。
2. AI结果和人工最终值分开保留证据。
3. 产品身份可以强依赖历史候选，箱数/日期/单号必须主要依赖当前图片。
4. `总件数 = 箱数 × 每箱件数` 由程序计算。
5. 同一 SKU 在“前面 / 后面”等多个位置出现时，原始行全部保留。
6. 后续完整导出必须包含 PostgreSQL 数据 + CSV/JSON/Excel + 全部原图。

## 下一阶段

- API 登录与小程序身份鉴权
- Nginx/Caddy HTTPS
- 字段局部裁图二次识别
- 重复发货单检测
- 商品库管理
- 统计页面
- Excel / CSV / JSON / ZIP 完整数据库导出
- PostgreSQL 与原图自动备份
