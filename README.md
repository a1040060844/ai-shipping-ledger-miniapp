# AI Shipping Ledger Mini Program

面向香皂发货业务的 AI 发货台账微信小程序。

核心目标不是“OCR 转文字”，而是：

1. 原始发货单永久保存、可追溯；
2. AI 多级识别与历史商品库复核；
3. 只有无法确定的字段才进入人工介入；
4. 发货数据结构化保存，支持按工厂 / 产品 / SKU / 日期统计；
5. 同一 SKU 在同一发货单中的多处记录保留原始明细，同时可自动汇总；
6. 任何统计结果都可以追溯到原图与字段位置；
7. 完整数据库和原始图片可以整体导出，不锁死在平台内。

## V1 范围

- 上传照片 / PDF
- 原图、增强图、缩略图三层文件记录
- OCR / 多模态视觉识别
- 大模型二次复核
- 产品库 / SKU / 工厂历史检索
- 规则校验（箱数、装箱数、总件数）
- 字段级可信度与人工复核
- 发货单台账
- 同 SKU 自动汇总
- 原图定位追溯
- 修改审计日志
- Excel / CSV / JSON / 完整归档包导出

## Phase 1：已完成数据模型

- 核心领域模型定义
- JSON Schema
- AI 识别状态机字段
- 原始证据链字段
- 可审计修改结构
- 同 SKU 汇总逻辑
- 两类业务结构的匿名样例
- 自动化测试

## Phase 2：已完成微信小程序交互骨架

当前仓库已经包含可导入微信开发者工具的 `miniprogram/`：

- 首页：累计发货单 / 箱数 / 件数、最近记录
- 上传：拍照、相册、聊天文件、PDF，多图视为同一张发货单
- 原图：识别前优先使用 `wx.saveFile` 持久化本地原件
- 详情：商品名称、SKU、规格、箱数、装箱数可以直接修改
- 自动保存：字段失焦即保存并写审计日志
- 自动算账：`总件数 = 箱数 × 每箱件数`
- 台账：结构化记录自动进入历史台账
- 原图追溯：详情页可直接预览上传的原始图片

详见：`docs/03-miniapp-prototype.md`

## Phase 3A：已完成 Qwen3.8-Flash 真实识别骨架

已经加入 `cloudfunctions/recognizeShipment/`：

- CloudBase 原图上传接口
- `qwen3.8-flash` 多模态 Provider
- 第一遍原图识别
- 根据第一遍结果检索 `products` / `factory_product_aliases`
- 最多 8 个历史商品候选
- 对不确定字段自动执行第二遍重点复核
- 产品字段与交易字段使用不同的可信度策略
- 箱数 / 每箱数量必须优先依据当前图片，历史值不能覆盖本次事实
- AI 不计算总件数；程序确定性执行乘法
- 无法确认的数据保持 `null`，不会静默变成 `0`
- `auto_accepted / ai_review_required / human_review_required` 状态
- 小程序可在 Mock / Cloud 两种识别模式之间切换

详见：`docs/04-qwen-cloud-recognition.md`

## 当前运行方式

如果只测试界面：

1. 微信开发者工具导入仓库根目录。
2. 当前 `appid` 为 `touristappid`。
3. `miniprogram/app.js` 保持 `recognitionMode: 'mock'`。

如果测试真实 Qwen：

1. 使用自己的微信小程序 AppID 和 CloudBase 环境。
2. 在 `miniprogram/app.js` 填写 `cloudEnvId`，并把 `recognitionMode` 改成 `cloud`。
3. 部署 `recognizeShipment` 云函数并安装云端依赖。
4. 给云函数配置 `DASHSCOPE_API_KEY`。
5. 可选配置 `QWEN_MODEL=qwen3.8-flash` 与 `DASHSCOPE_BASE_URL`。

API Key 不进入 Git 仓库。

## 当前限制

- 正式数据库集合尚未创建，台账仍主要使用小程序本地 Storage；
- CloudBase 当前先用于真实识别所需的原始文件上传；
- PDF 上传入口已经存在，但 Phase 3A 的真实模型链路先处理图片；
- 专用 OCR 层尚未单独插入，目前第一遍由多模态模型直接看图；
- 第二遍复核目前聚焦字段重新看整图，后续升级为字段坐标局部裁图；
- 完整数据库 ZIP / Excel / CSV / JSON 导出尚未实现。

## 下一阶段：Phase 3B

建立正式 CloudBase 数据层：

`source_files → shipments → shipment_items → products → factories → aliases → field_evidence → audit_logs`

然后把小程序本地台账迁移到正式云数据库，并继续实现原图字段定位、局部裁图复核、重复单检测和完整数据库导出。
