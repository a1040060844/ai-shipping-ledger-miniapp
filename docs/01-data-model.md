# Canonical Data Model

这是平台无关的标准数据模型。无论未来使用 CloudBase、PostgreSQL 或其他数据库，业务语义保持不变。

## Shipment（发货单）

- `id`: 内部唯一 ID
- `factoryId`: 工厂 ID
- `shipmentDate`: 发货日期；若原单缺失不得伪装为识别日期
- `documentNo`: 发货单号，可为空
- `status`: `active | corrected | void`
- `sourceFileIds`: 原始文件 ID 列表
- `items`: 原始商品明细行
- `createdAt`: 录入时间
- `updatedAt`: 更新时间

## ShipmentItem（原始商品明细）

每个 item 对应原单的一行或一个逻辑明细，不能因为 SKU 相同就覆盖。

- `id`
- `shipmentId`
- `sourceFileId`
- `sourceRegion`: 字段来源区域，可用于原图定位
- `loadSection`: 如 `front / back / unknown`
- `sourceText`: OCR 原文，不覆盖
- `skuObserved`: 本次单据实际看到 / 推断的 SKU
- `productId`: 标准产品 ID
- `productNameObserved`: 原单商品名
- `productNameNormalized`: 标准商品名
- `specification`
- `color`
- `variant`
- `cartons`
- `unitsPerCarton`
- `totalUnits`: 程序计算值
- `evidence`: OCR、AI、历史检索、人工修正证据

## SourceFile（原始证据）

- `originalObjectKey`: 原始文件，永不覆盖
- `enhancedObjectKey`: 识别增强版
- `thumbnailObjectKey`: 列表缩略图
- `sha256`: 重复单据检测基础
- `mimeType`
- `width / height`
- `uploadedAt`

## FieldEvidence（字段证据）

每个关键字段可记录：

- `field`
- `ocrValue`
- `ocrConfidence`
- `aiValue`
- `aiConfidence`
- `finalValue`
- `decision`: `auto | ai_review | human`
- `visualConfirmed`: 是否可直接从图像确认
- `historyMatched`: 是否与产品库/历史匹配
- `notes`
- `region`: 原图坐标

## Product（标准产品）

- `id`: 永久标准产品 ID
- `canonicalName`
- `specification`
- `color`
- `variant`
- `defaultUnitsPerCarton`: 仅作为常用值，不得覆盖本次原单
- `active`

## FactoryProductAlias（工厂商品别名）

用于将工厂自己的 SKU、产品叫法映射到标准产品。

- `factoryId`
- `productId`
- `factorySku`
- `factoryName`
- `aliases[]`
- `commonUnitsPerCarton[]`

## AuditLog（修改记录）

- `entityType`
- `entityId`
- `field`
- `before`
- `after`
- `actor`: `ocr | ai | human | system`
- `reason`
- `createdAt`

## 导出原则

完整导出至少包含：

- shipments
- shipment_items
- source_files
- products
- factories
- factory_product_aliases
- field_evidence
- audit_logs
- 原始图片目录

支持 Excel / CSV / JSON，以及包含数据库与原图的 ZIP 归档包。
