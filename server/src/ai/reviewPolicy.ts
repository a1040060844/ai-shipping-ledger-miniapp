import type { RecognitionDraft, RecognizedField } from './recognitionSchema.js'

const productFields = ['skuObserved', 'productNameNormalized', 'specification', 'color', 'variant'] as const
const transactionFields = ['cartons', 'unitsPerCarton'] as const

function productDecision(field: RecognizedField<unknown>) {
  if (field.value == null) return 'human'
  if (field.confidence >= 0.92 && (field.visualConfirmed || field.historyMatched)) return 'auto'
  if (field.confidence >= 0.78) return 'ai_review'
  return 'human'
}

function transactionDecision(field: RecognizedField<unknown>) {
  if (field.value == null) return 'human'
  if (field.visualConfirmed && field.confidence >= 0.92) return 'auto'
  if (field.visualConfirmed && field.confidence >= 0.8) return 'ai_review'
  return 'human'
}

export function buildReviewPlan(draft: RecognitionDraft, reviewedTwice: boolean) {
  const plan: Array<{ itemIndex: number; field: string; decision: string }> = []

  draft.items.forEach((item, itemIndex) => {
    productFields.forEach((field) => {
      let decision = productDecision(item[field])
      if (reviewedTwice && decision === 'ai_review') decision = 'human'
      plan.push({ itemIndex, field, decision })
    })

    transactionFields.forEach((field) => {
      let decision = transactionDecision(item[field])
      if (reviewedTwice && decision === 'ai_review') decision = 'human'
      plan.push({ itemIndex, field, decision })
    })
  })

  return plan
}

export function overallRecognitionStatus(plan: Array<{ decision: string }>) {
  if (plan.some((entry) => entry.decision === 'human')) return 'HUMAN_REVIEW' as const
  if (plan.some((entry) => entry.decision === 'ai_review')) return 'AI_REVIEW' as const
  return 'AUTO_ACCEPT' as const
}
