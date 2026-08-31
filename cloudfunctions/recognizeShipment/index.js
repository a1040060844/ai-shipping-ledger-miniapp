const cloud = require('wx-server-sdk')
const { requestRecognition } = require('./providers/qwen')
const { rankProductCandidates, hintsFromRecognition } = require('./lib/candidateRetriever')
const { buildReviewPlan, mergeRecognitionPasses } = require('./lib/reviewPolicy')
const { normalizeRecognition } = require('./lib/normalizeResult')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function safeReadCollection(name, limit) {
  try {
    const result = await db.collection(name).limit(limit).get()
    return result.data || []
  } catch (error) {
    return []
  }
}

async function loadCatalog() {
  const [products, aliases] = await Promise.all([
    safeReadCollection('products', 200),
    safeReadCollection('factory_product_aliases', 500)
  ])
  return { products, aliases }
}

function normalizeMimeType(file) {
  if (file.mimeType) return file.mimeType
  const name = String(file.name || '').toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

async function downloadImages(sourceFiles) {
  const images = []
  const unsupported = []

  for (const sourceFile of sourceFiles) {
    if (!sourceFile.cloudFileId) continue
    if (sourceFile.type === 'pdf' || /\.pdf$/i.test(sourceFile.name || '')) {
      unsupported.push(sourceFile)
      continue
    }
    const downloaded = await cloud.downloadFile({ fileID: sourceFile.cloudFileId })
    images.push({
      buffer: downloaded.fileContent,
      mimeType: normalizeMimeType(sourceFile),
      sourceFileId: sourceFile.id || null
    })
  }

  return { images, unsupported }
}

function shouldSecondPass(reviewPlan, candidates) {
  if (!reviewPlan.length) return false
  if (reviewPlan.length > 12) return false
  return candidates.length > 0 || reviewPlan.some((entry) => entry.decision === 'ai_review')
}

exports.main = async (event) => {
  try {
    const sourceFiles = Array.isArray(event.sourceFiles) ? event.sourceFiles : []
    if (!sourceFiles.length) {
      return { ok: false, code: 'NO_SOURCE_FILES', message: '没有收到原始发货单文件' }
    }
    if (!process.env.DASHSCOPE_API_KEY) {
      return { ok: false, code: 'AI_NOT_CONFIGURED', message: '云函数尚未配置 DASHSCOPE_API_KEY' }
    }

    const { images, unsupported } = await downloadImages(sourceFiles)
    if (!images.length) {
      return {
        ok: false,
        code: 'NO_SUPPORTED_IMAGES',
        message: unsupported.length ? '当前 Phase 3A 暂未直接解析 PDF，请先上传图片' : '没有可识别的图片'
      }
    }

    const firstPass = await requestRecognition({ images, mode: 'first_pass' })
    const catalog = await loadCatalog()
    const candidates = rankProductCandidates({
      hints: hintsFromRecognition(firstPass),
      products: catalog.products,
      aliases: catalog.aliases,
      limit: 8
    })

    const firstReviewPlan = buildReviewPlan(firstPass)
    let finalRecognition = firstPass
    let secondPassRan = false

    if (shouldSecondPass(firstReviewPlan, candidates)) {
      const secondPass = await requestRecognition({
        images,
        candidates,
        firstPass,
        reviewPlan: firstReviewPlan,
        mode: 'focused_review'
      })
      finalRecognition = mergeRecognitionPasses(firstPass, secondPass)
      secondPassRan = true
    }

    const shipment = normalizeRecognition(finalRecognition, sourceFiles)

    return {
      ok: true,
      shipment,
      diagnostics: {
        model: process.env.QWEN_MODEL || 'qwen3.8-flash',
        secondPassRan,
        candidateCount: candidates.length,
        unresolvedFields: buildReviewPlan(finalRecognition),
        unsupportedFiles: unsupported.map((file) => ({ id: file.id || null, name: file.name || '' }))
      }
    }
  } catch (error) {
    console.error('recognizeShipment failed', error)
    return {
      ok: false,
      code: 'RECOGNITION_FAILED',
      message: error && error.message ? error.message : '识别失败'
    }
  }
}
