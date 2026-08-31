const test = require('node:test')
const assert = require('node:assert/strict')
const { rankProductCandidates } = require('../cloudfunctions/recognizeShipment/lib/candidateRetriever')

test('exact factory SKU outranks fuzzy product text', () => {
  const products = [
    { id: 'p1', canonicalName: 'PS光板药丸精油皂', specification: '100克' },
    { id: 'p2', canonicalName: '双色精油皂', specification: '100克' }
  ]
  const aliases = [
    { productId: 'p1', factorySku: 'J2608035', factoryName: 'PS药丸皂白橙B', aliases: ['PS白橙B'] },
    { productId: 'p2', factorySku: 'T1', factoryName: '双色精油皂T1', aliases: [] }
  ]

  const candidates = rankProductCandidates({
    hints: ['J2608035'],
    products,
    aliases
  })

  assert.equal(candidates[0].productId, 'p1')
  assert.equal(candidates[0].score, 1)
})
