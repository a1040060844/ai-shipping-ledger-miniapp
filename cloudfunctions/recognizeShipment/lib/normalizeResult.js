const { finalRecognitionStatus, buildReviewPlan } = require('./reviewPolicy')

function unwrap(field) {
  return field && field.value !== undefined ? field.value : null
}

function uiFieldState(decision) {
  return decision === 'auto' ? 'auto' : 'needs_review'
}

function evidenceFor(fieldName, field, decision) {
  if (!field) return null
  return {
    field: fieldName,
    ocrValue: null,
    ocrConfidence: null,
    aiValue: field.value !== undefined ? field.value : null,
    aiConfidence: Number.isFinite(Number(field.confidence)) ? Number(field.confidence) : 0,
    finalValue: field.value !== undefined ? field.value : null,
    decision,
    visualConfirmed: field.visualConfirmed === true,
    historyMatched: field.historyMatched === true,
    inferredFromHistory: field.inferredFromHistory === true,
    notes: null,
    region: field.region || null
  }
}

function normalizeRecognition(recognition, sourceFiles, now = new Date()) {
  const timestamp = now.toISOString()
  const id = `shipment_${now.getTime()}`
  const plan = buildReviewPlan(recognition)
  const decisionByField = new Map(plan.map((entry) => [`${entry.itemIndex}:${entry.fieldName}`, entry.decision]))

  const items = (recognition.items || []).map((item, itemIndex) => {
    const cartonsRaw = unwrap(item.cartons)
    const unitsPerCartonRaw = unwrap(item.unitsPerCarton)
    const cartons = cartonsRaw === null || cartonsRaw === '' ? NaN : Number(cartonsRaw)
    const unitsPerCarton = unitsPerCartonRaw === null || unitsPerCartonRaw === '' ? NaN : Number(unitsPerCartonRaw)
    const validCartons = Number.isFinite(cartons) && cartons >= 0 ? cartons : null
    const validUnitsPerCarton = Number.isFinite(unitsPerCarton) && unitsPerCarton >= 0 ? unitsPerCarton : null
    const totalUnits = validCartons !== null && validUnitsPerCarton !== null
      ? validCartons * validUnitsPerCarton
      : null

    const evidence = []
    const fieldState = {}
    let needsReview = false

    ;['skuObserved', 'productNameNormalized', 'specification', 'color', 'variant', 'cartons', 'unitsPerCarton'].forEach((fieldName) => {
      const decision = decisionByField.get(`${itemIndex}:${fieldName}`) || 'auto'
      const fieldEvidence = evidenceFor(fieldName, item[fieldName], decision)
      if (fieldEvidence) evidence.push(fieldEvidence)
      fieldState[fieldName] = uiFieldState(decision)
      if (decision !== 'auto') needsReview = true
    })

    return {
      id: `${id}_item_${itemIndex + 1}`,
      sourceFileId: sourceFiles[0] && sourceFiles[0].id ? sourceFiles[0].id : null,
      sourceRegion: null,
      loadSection: 'unknown',
      sourceText: item.sourceText || '',
      skuObserved: unwrap(item.skuObserved) || '',
      productId: item.candidateProductId || null,
      productNameObserved: unwrap(item.productNameNormalized) || '',
      productNameNormalized: unwrap(item.productNameNormalized) || '',
      specification: unwrap(item.specification) || '',
      color: unwrap(item.color) || '',
      variant: unwrap(item.variant) || '',
      cartons: validCartons,
      unitsPerCarton: validUnitsPerCarton,
      totalUnits,
      fieldState,
      needsReview,
      evidence
    }
  })

  return {
    id,
    factoryId: null,
    factoryName: unwrap(recognition.factoryName) || '未识别工厂',
    shipmentDate: unwrap(recognition.shipmentDate) || null,
    documentNo: unwrap(recognition.documentNo) || '',
    status: 'active',
    recognitionStatus: finalRecognitionStatus(recognition),
    sourceFiles,
    items,
    auditLogs: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

module.exports = {
  normalizeRecognition
}
