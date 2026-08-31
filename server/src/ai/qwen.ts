import OpenAI from 'openai'
import { config } from '../config.js'
import { recognitionJsonSchema, type RecognitionDraft } from './recognitionSchema.js'

type ImageInput = {
  mimeType: string
  buffer: Buffer
}

type CandidateProduct = {
  productId: string
  canonicalName: string
  specification?: string | null
  color?: string | null
  variant?: string | null
  factorySku?: string | null
  aliases?: unknown
  commonUnitsPerCarton?: unknown
}

function client() {
  if (!config.DASHSCOPE_API_KEY || !config.DASHSCOPE_BASE_URL) {
    throw new Error('Qwen is not configured: set DASHSCOPE_API_KEY and DASHSCOPE_BASE_URL')
  }

  return new OpenAI({
    apiKey: config.DASHSCOPE_API_KEY,
    baseURL: config.DASHSCOPE_BASE_URL
  })
}

function systemPrompt(hasCandidates: boolean) {
  return [
    '你负责识别香皂发货单，并严格输出指定 JSON Schema。',
    '最高优先级证据永远是当前上传的原始图片。',
    '历史商品候选只允许辅助判断 SKU、标准商品名、规格、颜色、款式、常见装箱规格。',
    '历史数据绝对不能覆盖本次发货的箱数、日期、单号等交易事实。',
    '如果图片不能直接确认某个交易数字，visualConfirmed 必须为 false；不能为了填满字段而猜。',
    '无法确定时 value 返回 null，并降低 confidence。',
    'cartons 与 unitsPerCarton 只提取图片上的原始数字，不计算 totalUnits。',
    hasCandidates
      ? '本轮提供了历史候选。只有证据足够时才设置 historyMatched=true；candidateProductId 必须来自候选列表，否则返回 null。'
      : '本轮没有历史候选，historyMatched 与 inferredFromHistory 必须为 false，candidateProductId 返回 null。'
  ].join('\n')
}

export async function extractShippingOrder(
  images: ImageInput[],
  candidates: CandidateProduct[] = [],
  previousDraft?: RecognitionDraft
): Promise<RecognitionDraft> {
  const openai = client()
  const content: any[] = images.map((image) => ({
    type: 'image_url',
    image_url: {
      url: `data:${image.mimeType};base64,${image.buffer.toString('base64')}`
    }
  }))

  content.push({
    type: 'text',
    text: [
      '请识别这一组属于同一张发货单的图片。',
      previousDraft ? `第一轮识别结果：${JSON.stringify(previousDraft)}` : '',
      candidates.length ? `历史商品候选：${JSON.stringify(candidates)}` : '',
      '需要保留同一 SKU 在原单不同位置出现的独立明细，不要擅自合并。'
    ].filter(Boolean).join('\n')
  })

  const response = await openai.chat.completions.create({
    model: config.QWEN_MODEL,
    messages: [
      { role: 'system', content: systemPrompt(candidates.length > 0) },
      { role: 'user', content }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: recognitionJsonSchema
    } as any
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('Qwen returned empty recognition result')
  return JSON.parse(raw) as RecognitionDraft
}
