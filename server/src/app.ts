import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { config } from './config.js'
import { prisma } from './db.js'
import { ensureBucket } from './storage/minio.js'
import { registerFileRoutes } from './routes/files.js'
import { registerRecognitionRoutes } from './routes/recognitions.js'
import { registerShipmentRoutes } from './routes/shipments.js'

const app = Fastify({ logger: true, bodyLimit: config.MAX_UPLOAD_BYTES + 1024 * 1024 })

await app.register(cors, { origin: true })
await app.register(multipart, {
  limits: {
    fileSize: config.MAX_UPLOAD_BYTES,
    files: 1
  }
})

app.get('/health', async () => ({
  ok: true,
  service: 'shipping-ledger-server',
  qwenConfigured: Boolean(config.DASHSCOPE_API_KEY && config.DASHSCOPE_BASE_URL)
}))

await registerFileRoutes(app)
await registerRecognitionRoutes(app)
await registerShipmentRoutes(app)

async function shutdown(signal: string) {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await ensureBucket()
  await prisma.$connect()
  await app.listen({ host: config.HOST, port: config.PORT })
} catch (error) {
  app.log.error(error)
  await prisma.$disconnect()
  process.exit(1)
}
