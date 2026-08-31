const test = require('node:test')
const assert = require('node:assert/strict')
const { decideField, buildReviewPlan } = require('../cloudfunctions/recognizeShipment/lib/reviewPolicy')

test('transaction quantity cannot auto-pass without visual confirmation', () => {
  assert.equal(decideField('cartons', {
    value: 50,
    confidence: 0.99,
    visualConfirmed: false,
    historyMatched: true,
    inferredFromHistory: true
  }), 'ai_review')
})

test('clear visually confirmed carton quantity auto-passes', () => {
  assert.equal(decideField('cartons', {
    value: 50,
    confidence: 0.97,
    visualConfirmed: true
  }), 'auto')
})

test('missing quantity is sent to human review plan', () => {
  const plan = buildReviewPlan({
    items: [{
      skuObserved: { value: 'J2608035', confidence: 0.99, visualConfirmed: true },
      productNameNormalized: { value: 'PS光板药丸精油皂', confidence: 0.99, visualConfirmed: true },
      specification: { value: '100克', confidence: 0.99, visualConfirmed: true },
      color: { value: '白色+橙色', confidence: 0.95, visualConfirmed: true },
      variant: { value: 'B', confidence: 0.96, visualConfirmed: true },
      cartons: { value: null, confidence: 0.2, visualConfirmed: false },
      unitsPerCarton: { value: 120, confidence: 0.99, visualConfirmed: true }
    }]
  })

  const cartons = plan.find((entry) => entry.fieldName === 'cartons')
  assert.equal(cartons.decision, 'human_review')
})
