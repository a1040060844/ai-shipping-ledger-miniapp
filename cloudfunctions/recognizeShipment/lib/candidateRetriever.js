function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\-_./\\()（）【】\[\]:：+*]/g, '')
}

function bigrams(value) {
  const text = normalizeText(value)
  if (!text) return []
  if (text.length === 1) return [text]
  const parts = []
  for (let i = 0; i < text.length - 1; i += 1) parts.push(text.slice(i, i + 2))
  return parts
}

function diceSimilarity(a, b) {
  const left = bigrams(a)
  const right = bigrams(b)
  if (!left.length || !right.length) return 0
  const counts = new Map()
  left.forEach((part) => counts.set(part, (counts.get(part) || 0) + 1))
  let intersection = 0
  right.forEach((part) => {
    const count = counts.get(part) || 0
    if (count > 0) {
      intersection += 1
      counts.set(part, count - 1)
    }
  })
  return (2 * intersection) / (left.length + right.length)
}

function candidateSearchText(product, alias) {
  return [
    product && product.canonicalName,
    product && product.specification,
    product && product.color,
    product && product.variant,
    alias && alias.factorySku,
    alias && alias.factoryName,
    ...((alias && alias.aliases) || [])
  ].filter(Boolean).join(' ')
}

function rankProductCandidates({ hints = [], products = [], aliases = [], limit = 8 }) {
  const cleanHints = hints.map(normalizeText).filter(Boolean)
  if (!cleanHints.length) return []

  const productById = new Map(products.map((product) => [product.id, product]))
  const aliasGroups = new Map()
  aliases.forEach((alias) => {
    if (!aliasGroups.has(alias.productId)) aliasGroups.set(alias.productId, [])
    aliasGroups.get(alias.productId).push(alias)
  })

  const scored = products.map((product) => {
    const productAliases = aliasGroups.get(product.id) || []
    const texts = [candidateSearchText(product, null), ...productAliases.map((alias) => candidateSearchText(product, alias))]
    let score = 0

    cleanHints.forEach((hint) => {
      texts.forEach((text) => {
        const normalized = normalizeText(text)
        if (!normalized) return
        if (normalized.includes(hint) || hint.includes(normalized)) score = Math.max(score, 0.96)
        score = Math.max(score, diceSimilarity(hint, normalized))
      })

      productAliases.forEach((alias) => {
        const sku = normalizeText(alias.factorySku)
        if (sku && sku === hint) score = Math.max(score, 1)
        else if (sku && (sku.includes(hint) || hint.includes(sku))) score = Math.max(score, 0.92)
      })
    })

    return {
      productId: product.id,
      canonicalName: product.canonicalName,
      specification: product.specification || null,
      color: product.color || null,
      variant: product.variant || null,
      defaultUnitsPerCarton: product.defaultUnitsPerCarton || null,
      aliases: productAliases.map((alias) => ({
        factoryId: alias.factoryId || null,
        factorySku: alias.factorySku || null,
        factoryName: alias.factoryName || null,
        aliases: alias.aliases || [],
        commonUnitsPerCarton: alias.commonUnitsPerCarton || []
      })),
      score: Number(score.toFixed(4))
    }
  })

  return scored
    .filter((candidate) => candidate.score > 0.22)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function hintsFromRecognition(recognition) {
  const hints = []
  ;(recognition.items || []).forEach((item) => {
    ;['skuObserved', 'productNameNormalized', 'specification', 'color', 'variant'].forEach((field) => {
      const value = item[field] && item[field].value
      if (value !== null && value !== undefined && value !== '') hints.push(String(value))
    })
    if (item.sourceText) hints.push(item.sourceText)
  })
  return hints
}

module.exports = {
  normalizeText,
  diceSimilarity,
  rankProductCandidates,
  hintsFromRecognition
}
