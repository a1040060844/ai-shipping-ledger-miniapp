# Phase 2：微信小程序交互骨架

本阶段目标是先把核心操作链路跑通，不提前绑定某一家 OCR / 大模型供应商。

## 已实现页面

1. `pages/index`：首页、累计箱数/件数、最近发货记录。
2. `pages/upload`：拍照/相册、聊天文件/PDF、多文件属于同一发货单。
3. `pages/detail`：发货详情、原图查看、字段直接编辑、自动重算总件数。
4. `pages/ledger`：全部发货台账。

## 当前数据存储

Phase 2 使用微信小程序本地存储作为可运行原型：

- 结构化记录：`wx.setStorageSync`
- 上传原图：优先 `wx.saveFile`
- 如果本地持久化失败，暂时保留临时路径并标记 `temp_fallback`

这不是最终生产存储方案。Phase 3 应切换到云端对象存储 + 数据库，原图上传成功后才能进入正式 AI 识别管线。

## 当前 AI 状态

`services/mockRecognition.js` 是明确标识的演示适配器，用来验证用户交互和数据流，不代表真实 OCR 结果。

后续替换时保持调用接口：

```js
recognize(sourceFiles) -> Promise<Shipment>
```

真实实现内部再完成：

原图上传 → 图像增强 → OCR → 多模态大模型 → 产品库检索 → 规则校验 → 字段级复核。

## 手工修改规则

详情页字段失焦后自动保存：

- 人工修改写入 `auditLogs`
- 被人工修正的字段标记 `human_confirmed`
- 修改 `cartons` / `unitsPerCarton` 后，由程序重新计算 `totalUnits`
- 不让 AI 负责乘法计算

## 原图原则

当前原型已经提供“查看原始发货单”入口。生产版需要升级为：

- `original`：不可覆盖原始文件
- `enhanced`：AI 识别增强图
- `thumbnail`：列表缩略图
- 字段坐标：点击数据可定位到原图对应区域

## 下一阶段（Phase 3）

1. CloudBase / 对象存储落地。
2. 建立 `shipments / shipment_items / source_files / products / factories / aliases / audit_logs` 数据集合。
3. 接真实 OCR + 多模态大模型适配器。
4. 建立商品历史检索和字段置信度。
5. 只把最终仍不确定的字段推给人工。
