import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { config } from '../config.js'
import { prisma } from '../db.js'
import { presignedReadUrl, putOriginalObject } from '../storage/minio.js'

function safeName(name: string) {
  return path.basename(name || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
}

function objectKey(filename: string) {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `original/${y}/${m}/${d}/${randomUUID()}_${safeName(filename)}`
}

export async function registerFileRoutes(app: FastifyInstance) {
  app.post('/api/v1/files/upload', async (request, reply) => {
    const part = await request.file({ limits: { fileSize: config.MAX_UPLOAD_BYTES, files: 1 } })
    if (!part) return reply.code(400).send({ error: 'file_required' })

    const buffer = await part.toBuffer()
    if (!buffer.length) return reply.code(400).send({ error: 'empty_file' })

    const sha256 = createHash('sha256').update(buffer).digest('hex')
    const key = objectKey(part.filename)
    await putOriginalObject(key, buffer, part.mimetype || 'application/octet-stream', sha256)

    const file = await prisma.sourceFile.create({
      data: {
        originalFilename: part.filename || 'upload.bin',
        originalObjectKey: key,
        sha256,
        mimeType: part.mimetype || 'application/octet-stream',
        fileSize: buffer.length
      }
    })

    return {
      file: {
        id: file.id,
        name: file.originalFilename,
        mimeType: file.mimeType,
        size: file.fileSize,
        sha256: file.sha256
      }
    }
  })

  app.get('/api/v1/files/:id/url', async (request, reply) => {
    const { id } = request.params as { id: string }
    const file = await prisma.sourceFile.findUnique({ where: { id } })
    if (!file) return reply.code(404).send({ error: 'file_not_found' })

    return { url: await presignedReadUrl(file.originalObjectKey, 900) }
  })
}
