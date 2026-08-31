import type { FastifyInstance } from 'fastify'
import { config } from '../config.js'
import { prisma } from '../db.js'
import { getObjectBuffer } from '../storage/minio.js'
import { extractShippingOrder } from '../ai/qwen.js'
import { findProductCandidates } from '../ai/candidates.js'
import { persistRecognition } from '../ai/persistRecognition.js'

export async function registerRecognitionRoutes(app: FastifyInstance) {
  app.post('/api/v1/recognitions', async (request, reply) => {
    const body = request.body as { sourceFileIds?: string[] }
    const sourceFileIds = Array.isArray(body?.sourceFileIds) ? body.sourceFileIds.filter(Boolean) : []
    if (!sourceFileIds.length) return reply.code(400).send({ error: 'source_file_ids_required' })

    const sourceFiles = await prisma.sourceFile.findMany({
      where: { id: { in: sourceFileIds } }
    })
    if (sourceFiles.length !== sourceFileIds.length) {
      return reply.code(404).send({ error: 'source_file_not_found' })
    }

    const aiJob = await prisma.aiJob.create({
      data: {
        model: config.QWEN_MODEL,
        stage: 'shipping_order_recognition',
        status: 'RUNNING',
        input: { sourceFileIds }
      }
    })

    try {
      const images = await Promise.all(sourceFiles.map(async (file) => ({
        mimeType: file.mimeType,
        buffer: await getObjectBuffer(file.originalObjectKey)
      })))

      const firstPass = await extractShippingOrder(images)
      const candidates = await findProductCandidates(firstPass, 8)

      const needsSecondPass = candidates.length > 0 || firstPass.items.some((item) =>
        item.cartons.confidence < 0.92 ||
        item.unitsPerCarton.confidence < 0.92 ||
        !item.cartons.visualConfirmed ||
        !item.unitsPerCarton.visualConfirmed ||
        item.productNameNormalized.confidence < 0.92
      )

      const finalDraft = needsSecondPass
        ? await extractShippingOrder(images, candidates, firstPass)
        : firstPass

      await prisma.aiJob.update({
        where: { id: aiJob.id },
        data: {
          status: 'SUCCEEDED',
          output: {
            firstPass,
            candidateCount: candidates.length,
            reviewedTwice: needsSecondPass,
            finalDraft
          }
        }
      })

      const shipment = await persistRecognition(finalDraft, sourceFileIds, needsSecondPass, aiJob.id)
      return { shipment }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await prisma.aiJob.update({
        where: { id: aiJob.id },
        data: { status: 'FAILED', error: message.slice(0, 4000) }
      })
      request.log.error({ err: error }, 'recognition failed')
      return reply.code(502).send({ error: 'recognition_failed', message })
    }
  })
}
