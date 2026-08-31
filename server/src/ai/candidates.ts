import { prisma } from '../db.js'
import type { RecognitionDraft } from './recognitionSchema.js'

function norm(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\-_\/]/g, '')
}

function textScore(observed: unknown, candidate: unknown, weight: number) {
  const a = norm(observed)
  const b = norm(candidate)
  if (!a || !b) return 0
  if (a === b) return weight
  if (a.includes(b) || b.includes(a)) return weight * 0.65

  const prefix = Math.min(a.length, b.length)
  let same = 0
  while (same < prefix && a[same] === b[same]) same += 1
  return weight * Math.min(0.5, same / Math.max(a.length, b.length))
}

export async function findProductCandidates(draft: RecognitionDraft, limit = 8) {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { aliases: true },
    take: 500
  })

  const observedItems = draft.items || []
  const scored = products.map((product) => {
    let score = 0

    for (const item of observedItems) {
      score = Math.max(
        score,
        textScore(item.productNameNormalized?.value, product.canonicalName, 50) +
          textScore(item.specification?.value, product.specification, 12) +
          textScore(item.color?.value, product.color, 10) +
          textScore(item.variant?.value, product.variant, 10)
      )

      for (const alias of product.aliases) {
        score = Math.max(
          score,
          textScore(item.skuObserved?.value, alias.factorySku, 100) +
            textScore(item.productNameNormalized?.value, alias.factoryName, 45)
        )
      }
    }

    return { product, score }
  })

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => {
      const alias = product.aliases[0]
      return {
        productId: product.id,
        canonicalName: product.canonicalName,
        specification: product.specification,
        color: product.color,
        variant: product.variant,
        factorySku: alias?.factorySku || null,
        aliases: alias?.aliases || null,
        commonUnitsPerCarton: alias?.commonUnitsPerCarton || null
      }
    })
}
