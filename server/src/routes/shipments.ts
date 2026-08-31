import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { serializeShipment } from '../ai/persistRecognition.js'

export async function registerShipmentRoutes(app: FastifyInstance) {
  app.get('/api/v1/shipments', async () => {
    const rows = await prisma.shipment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true }
    })
    const shipments = await Promise.all(rows.map((row) => serializeShipment(row.id)))
    return { shipments: shipments.filter(Boolean) }
  })

  app.get('/api/v1/shipments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const shipment = await serializeShipment(id)
    if (!shipment) return reply.code(404).send({ error: 'shipment_not_found' })
    return { shipment }
  })
}
