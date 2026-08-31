# Phase 3A：Qwen3.8-Flash 云端识别骨架

本阶段把 Phase 2 的 Mock AI 抽象为可接真实模型的 CloudBase 云函数链路，同时继续保留 Mock 模式，方便没有云环境时本地调试。

## 当前链路

小程序上传原图
→ 本地保留一份原始文件
→ CloudBase 对象存储保存原件
→ `recognizeShipment` 云函数
→ Qwen3.8-Flash 第一遍看图
→ 从第一遍结果提取 SKU / 产品名等提示词
→ 检索 `products` 与 `factory_product_aliases`
→ 选出最多 8 个候选商品
→ 对不确定字段自动做第二遍重点复核
→ 字段级规则校验
→ 转为 Canonical Shipment
→ 仍不能确定的字段进入人工复核状态

## 为什么先看图，再检索历史

拍照模糊时，第一遍模型可能只能读出 `J260803S`。系统随后用该结果检索历史商品库，找到例如 `J2608035` 等候选，再把候选连同原图交给第二遍模型。

这样任务从“开放式猜 SKU”变成“在少量历史候选中核对图片证据”。

## 交易字段的保守规则

`cartons`、`unitsPerCarton` 等会直接影响账目的字段不能因为历史记录常见就自动通过。

当前策略：

- 当前图像直接确认 + 高置信度：`auto`
- 看到了疑似值但证据不够：`ai_review`
- 缺失或低置信度：`human_review`

历史装箱数可以提醒异常，但不能覆盖当前单据。

## Qwen 环境变量

在 CloudBase 云函数环境中配置，不写进 Git：

- `DASHSCOPE_API_KEY`：必填
- `QWEN_MODEL`：默认 `qwen3.8-flash`
- `DASHSCOPE_BASE_URL`：可选；默认使用 DashScope OpenAI 兼容接口地址

## 小程序切换真实识别

`miniprogram/app.js` 当前仍保留：

```js
recognitionMode: 'mock',
cloudEnvId: ''
```

正式测试时：

1. 填入自己的 CloudBase 环境 ID；
2. 把 `recognitionMode` 改为 `cloud`；
3. 在微信开发者工具中部署 `recognizeShipment` 云函数并安装依赖；
4. 给云函数配置 `DASHSCOPE_API_KEY`。

## 数据集合

当前云函数会尝试读取：

- `products`
- `factory_product_aliases`

如果集合暂时不存在，识别仍可运行，只是没有历史商品二次检索能力。

下一子阶段会正式建立：

- `shipments`
- `shipment_items`
- `source_files`
- `products`
- `factories`
- `factory_product_aliases`
- `field_evidence`
- `audit_logs`

## 当前限制

1. Phase 3A 真实模型入口先支持图片；PDF 仍保留上传能力，但云函数会明确提示尚未解析 PDF。
2. 第二遍复核目前重新查看整张原图并聚焦指定字段；后续加入字段坐标后，会升级成“局部裁图 + 放大 + 二次模型复核”。
3. 当前商品候选检索是轻量内存排序，正式数据量增长后应改成索引检索。
4. 专用 OCR 层尚未插入；当前第一遍由多模态模型承担视觉读取。后续可在 Qwen 前增加 OCR，并把 OCR 文本与坐标作为额外证据。

这些限制不会改变已经确定的核心原则：原图最高优先级、历史只辅助、AI 不负责算账、无法确认才人工介入。
