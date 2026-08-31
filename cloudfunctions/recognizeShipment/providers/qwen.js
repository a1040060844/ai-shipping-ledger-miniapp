const https = require('https')

const DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const DEFAULT_MODEL = 'qwen3.8-flash'

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const payload = JSON.stringify(body)
    const req = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      },
      timeout: 60000
    }, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        let parsed
        try {
          parsed = raw ? JSON.parse(raw) : {}
        } catch (error) {
          reject(new Error(`Qwen returned invalid JSON: ${raw.slice(0, 500)}`))
          return
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Qwen HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 800)}`))
          return
        }
        resolve(parsed)
      })
    })
    req.on('timeout', () => req.destroy(new Error('Qwen request timeout')))
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function imagePart(image) {
  const mimeType = image.mimeType || 'image/jpeg'
  const base64 = image.buffer.toString('base64')
  return {
    type: 'image_url',
    image_url: {
      url: `data:${mimeType};base64,${base64}`
    }
  }
}

function systemPrompt() {
  return [
    '你是香皂发货单结构化识别与复核模型。',
    '目标是提取真实可追溯的数据，不追求把所有字段都填满。看不清时必须返回 null 或低置信度，禁止猜测。',
    '业务先验：货物基本都是香皂，且很多商品历史上发过；历史商品只能辅助识别产品字段，不能覆盖当前单据的箱数、日期、单号等交易事实。',
    '箱数 cartons 和每箱数量 unitsPerCarton 必须优先依据当前图片。若只是从历史推断，inferredFromHistory 必须为 true，visualConfirmed 必须为 false。',
    '不要计算 totalUnits；总件数由程序做确定性乘法。',
    '必须返回 JSON，不要输出解释性正文。'
  ].join('\n')
}

function outputContract() {
  return {
    factoryName: { value: 'string|null', confidence: '0..1', visualConfirmed: 'boolean' },
    shipmentDate: { value: 'YYYY-MM-DD|null', confidence: '0..1', visualConfirmed: 'boolean' },
    documentNo: { value: 'string|null', confidence: '0..1', visualConfirmed: 'boolean' },
    items: [
      {
        sourceText: 'string|null',
        candidateProductId: 'string|null',
        skuObserved: { value: 'string|null', confidence: '0..1', visualConfirmed: 'boolean', historyMatched: 'boolean', inferredFromHistory: 'boolean' },
        productNameNormalized: { value: 'string|null', confidence: '0..1', visualConfirmed: 'boolean', historyMatched: 'boolean', inferredFromHistory: 'boolean' },
        specification: { value: 'string|null', confidence: '0..1', visualConfirmed: 'boolean', historyMatched: 'boolean', inferredFromHistory: 'boolean' },
        color: { value: 'string|null', confidence: '0..1', visualConfirmed: 'boolean', historyMatched: 'boolean', inferredFromHistory: 'boolean' },
        variant: { value: 'string|null', confidence: '0..1', visualConfirmed: 'boolean', historyMatched: 'boolean', inferredFromHistory: 'boolean' },
        cartons: { value: 'number|null', confidence: '0..1', visualConfirmed: 'boolean', historyMatched: 'boolean', inferredFromHistory: 'boolean' },
        unitsPerCarton: { value: 'number|null', confidence: '0..1', visualConfirmed: 'boolean', historyMatched: 'boolean', inferredFromHistory: 'boolean' }
      }
    ]
  }
}

function userText({ candidates, firstPass, reviewPlan, mode }) {
  const common = {
    task: mode === 'focused_review' ? '二次复核第一遍不确定的字段' : '第一次识别发货单',
    outputContract: outputContract(),
    productCandidates: candidates || []
  }

  if (mode === 'focused_review') {
    common.firstPass = firstPass
    common.fieldsToReview = reviewPlan
    common.rules = [
      '只重点复核 fieldsToReview 中列出的字段，但 items 数组顺序必须和 firstPass 保持一致。',
      '只有图片或候选商品提供更强证据时才修正。',
      '对于 cartons 等交易字段，即使历史值很常见，也不能用历史值覆盖看不清的当前图片。',
      '如果仍不能确定，保留低 confidence，不要强行给出确定答案。'
    ]
  } else {
    common.rules = [
      '尽量逐行保留原始商品明细，同一 SKU 在前面/后面重复出现也不要合并。',
      'SKU、产品名、规格、颜色、款式可以参考历史候选。',
      '箱数和每箱数量必须主要看当前图片。',
      '看不清的数字返回 null 或低 confidence。'
    ]
  }

  return JSON.stringify(common)
}

function extractJsonContent(response) {
  const content = response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content
  if (!content) throw new Error('Qwen response has no message content')
  if (typeof content === 'object') return content
  try {
    return JSON.parse(content)
  } catch (error) {
    const match = String(content).match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`Qwen response is not JSON: ${String(content).slice(0, 500)}`)
    return JSON.parse(match[0])
  }
}

async function requestRecognition({ images, candidates = [], firstPass = null, reviewPlan = [], mode = 'first_pass' }) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not configured')
  const endpoint = process.env.DASHSCOPE_BASE_URL || DEFAULT_ENDPOINT
  const model = process.env.QWEN_MODEL || DEFAULT_MODEL

  const response = await postJson(endpoint, {
    Authorization: `Bearer ${apiKey}`
  }, {
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt() },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText({ candidates, firstPass, reviewPlan, mode }) },
          ...images.map(imagePart)
        ]
      }
    ]
  })

  return extractJsonContent(response)
}

module.exports = {
  requestRecognition
}
