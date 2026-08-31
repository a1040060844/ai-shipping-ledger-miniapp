import { prisma } from '../db.js'
import type { RecognitionDraft, RecognizedField } from './recognitionSchema.js'
import { buildReviewPlan, overallRecognitionStatus } from './reviewPolicy.js'

function parseDate(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function fieldState(plan: Array<{ itemIndex: number; field: string; decision: string }>, itemIndex: number, field: string) {
  return plan.find((entry) => entry.itemIndex === itemIndex && entry.field === field)?.decision || 'auto'
}

function evidenceData(field: string, value: RecognizedField<any>, decision: string) {
  return {
    field,
    aiValue: value.value == null ? undefined : (value.value as any),
    aiConfidence: Number(value.confidence) || 0,
    finalValue: value.value == null ? undefined : (value.value as any),
    decision,
    visualConfirmed: value.visualConfirmed === true,
    historyMatched: value.historyMatched === true,
    inferredFromHistory: value.inferredFromHistory === true
  }
}

export async function persistRecognition(
  draft: RecognitionDraft,
  sourceFileIds: string[],
  reviewedTwice: boolean,
  aiJobId?: string
) {
  const plan = buildReviewPlan(draft, reviewedTwice)
  const recognitionStatus = overallRecognitionStatus(plan)

  let factoryId: string | null = null
  if (draft.factoryName.value && draft.factoryName.confidence >= 0.75) {
    const factory = await prisma.factory.upsert({
      where: { name: draft.factoryName.value },
      update: {},
      create: { name: draft.factoryName.value }
    })
    factoryId = factory.id
  }

  const totalCartons = draft.items.reduce((sum, item) => sum + (Number(item.cartons.value) || 0), 0)
  const totalUnits = draft.items.reduce((sum, item) => {
    const cartons = Number(item.cartons.value)
    const unitsPerCarton = Number(item.unitsPerCarton.value)
    if (!Number.isFinite(cartons) || !Number.isFinite(unitsPerCarton)) return sum
    return sum + cartons * unitsPerCarton
  }, 0)

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        factoryId,
        shipmentDate: parseDate(draft.shipmentDate.value),
        documentNo: draft.documentNo.value || null,
        recognitionStatus,
        totalCartons,
        totalUnits
      }
    })

    await tx.sourceFile.updateMany({
      where: { id: { in: sourceFileIds } },
      data: { shipmentId: created.id }
    })

    if (aiJobId) {
      await tx.aiJob.update({ where: { id: aiJobId }, data: { shipmentId: created.id } })
    }

    for (let itemIndex = 0; itemIndex < draft.items.length; itemIndex += 1) {
      const item = draft.items[itemIndex]
      const cartons = item.cartons.value == null ? null : Number(item.cartons.value)
      const unitsPerCarton = item.unitsPerCarton.value == null ? null : Number(item.unitsPerCarton.value)
      const validCartons = typeof cartons === 'number' && Number.isFinite(cartons)
      const validUnitsPerCarton = typeof unitsPerCarton === 'number' && Number.isFinite(unitsPerCarton)
      const total = validCartons && validUnitsPerCarton ? cartons * unitsPerCarton : null

      const createdItem = await tx.shipmentItem.create({
        data: {
          shipmentId: created.id,
          sourceFileId: sourceFileIds[0] || null,
          productId: item.candidateProductId || null,
          sourceText: item.sourceText || null,
          skuObserved: item.skuObserved.value,
          productNameObserved: item.productNameNormalized.value,
          productNameNormalized: item.productNameNormalized.value,
          specification: item.specification.value,
          color: item.color.value,
          variant: item.variant.value,
          cartons: validCartons ? cartons : null,
          unitsPerCarton: validUnitsPerCarton ? unitsPerCarton : null,
          totalUnits: total
        }
      })

      const evidenceFields = {
        skuObserved: item.skuObserved,
        productNameNormalized: item.productNameNormalized,
        specification: item.specification,
        color: item.color,
        variant: item.variant,
        cartons: item.cartons,
        unitsPerCarton: item.unitsPerCarton
      }

      await tx.fieldEvidence.createMany({
        data: Object.entries(evidenceFields).map(([field, value]) => ({
          ...evidenceData(field, value, fieldState(plan, itemIndex, field)),
          shipmentItemId: createdItem.id
        }))
      })
    }

    return created
  })

  return serializeShipment(shipment.id)
}

export async function serializeShipment(id: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      factory: true,
      sourceFiles: true,
      items: { include: { evidence: true } }
    }
  })
  if (!shipment) return null

  return {
    id: shipment.id,
    factoryId: shipment.factoryId,
    factoryName: shipment.factory?.name || '未识别工厂',
    shipmentDate: shipment.shipmentDate ? shipment.shipmentDate.toISOString().slice(0, 10) : null,
    documentNo: shipment.documentNo || '',
    status: shipment.status.toLowerCase(),
    recognitionStatus: shipment.recognitionStatus,
    totalCartons: shipment.totalCartons,
    totalUnits: shipment.totalUnits,
    serverSourceFiles: shipment.sourceFiles.map((file) => ({
      id: file.id,
      name: file.originalFilename,
      mimeType: file.mimeType,
      sha256: file.sha256
    })),
    items: shipment.items.map((item) => ({
      id: item.id,
      sourceText: item.sourceText || '',
      skuObserved: item.skuObserved || '',
      productId: item.productId,
      productNameNormalized: item.productNameNormalized || '',
      specification: item.specification || '',
      color: item.color || '',
      variant: item.variant || '',
      cartons: item.cartons,
      unitsPerCarton: item.unitsPerCarton,
      totalUnits: item.totalUnits,
      fieldState: Object.fromEntries(item.evidence.map((e) => [e.field, e.decision]))
    })),
    auditLogs: [],
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString()
  }
}
