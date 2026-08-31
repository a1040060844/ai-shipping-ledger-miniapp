const PRODUCT_FIELDS = ['skuObserved', 'productNameNormalized', 'specification', 'color', 'variant']
const TRANSACTION_FIELDS = ['cartons', 'unitsPerCarton']
const REVIEW_FIELDS = [...PRODUCT_FIELDS, ...TRANSACTION_FIELDS]

function confidenceOf(field) {
  const value = Number(field && field.confidence)
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function decideField(fieldName, field) {
  if (!field || field.value === null || field.value === undefined || field.value === '') return 'human_review'
  const confidence = confidenceOf(field)
  const visualConfirmed = field.visualConfirmed === true
  const historyMatched = field.historyMatched === true

  if (TRANSACTION_FIELDS.includes(fieldName)) {
    if (visualConfirmed && confidence >= 0.93) return 'auto'
    if (confidence >= 0.65) return 'ai_review'
    return 'human_review'
  }

  if (visualConfirmed && confidence >= 0.9) return 'auto'
  if (historyMatched && confidence >= 0.88) return 'auto'
  if (confidence >= 0.62) return 'ai_review'
  return 'human_review'
}

function buildReviewPlan(recognition) {
  const unresolved = []
  ;(recognition.items || []).forEach((item, itemIndex) => {
    REVIEW_FIELDS.forEach((fieldName) => {
      const decision = decideField(fieldName, item[fieldName])
      if (decision !== 'auto') {
        unresolved.push({
          itemIndex,
          fieldName,
          decision,
          value: item[fieldName] && item[fieldName].value,
          confidence: confidenceOf(item[fieldName])
        })
      }
    })
  })
  return unresolved
}

function fieldScore(fieldName, field) {
  if (!field) return -1
  let score = confidenceOf(field)
  if (field.visualConfirmed === true) score += TRANSACTION_FIELDS.includes(fieldName) ? 0.35 : 0.2
  if (field.historyMatched === true && PRODUCT_FIELDS.includes(fieldName)) score += 0.08
  if (field.inferredFromHistory === true && TRANSACTION_FIELDS.includes(fieldName)) score -= 0.3
  return score
}

function mergeRecognitionPasses(firstPass, secondPass) {
  if (!secondPass || !Array.isArray(secondPass.items)) return firstPass
  const merged = JSON.parse(JSON.stringify(firstPass))

  secondPass.items.forEach((reviewItem, index) => {
    if (!merged.items[index]) return
    REVIEW_FIELDS.forEach((fieldName) => {
      if (fieldScore(fieldName, reviewItem[fieldName]) > fieldScore(fieldName, merged.items[index][fieldName])) {
        merged.items[index][fieldName] = reviewItem[fieldName]
      }
    })
    if (reviewItem.sourceText && !merged.items[index].sourceText) merged.items[index].sourceText = reviewItem.sourceText
    if (reviewItem.candidateProductId) merged.items[index].candidateProductId = reviewItem.candidateProductId
  })

  return merged
}

function finalRecognitionStatus(recognition) {
  const plan = buildReviewPlan(recognition)
  if (!plan.length) return 'auto_accepted'
  if (plan.some((entry) => entry.decision === 'human_review')) return 'human_review_required'
  return 'ai_review_required'
}

module.exports = {
  REVIEW_FIELDS,
  decideField,
  buildReviewPlan,
  mergeRecognitionPasses,
  finalRecognitionStatus
}
