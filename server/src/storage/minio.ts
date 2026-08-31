import { Client } from 'minio'
import { config } from '../config.js'

export const minio = new Client({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY
})

export async function ensureBucket() {
  const exists = await minio.bucketExists(config.MINIO_BUCKET)
  if (!exists) await minio.makeBucket(config.MINIO_BUCKET)
}

export async function putOriginalObject(objectKey: string, buffer: Buffer, mimeType: string, sha256: string) {
  await minio.putObject(config.MINIO_BUCKET, objectKey, buffer, buffer.length, {
    'Content-Type': mimeType,
    'x-amz-meta-sha256': sha256
  })
}

export async function getObjectBuffer(objectKey: string) {
  const stream = await minio.getObject(config.MINIO_BUCKET, objectKey)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export async function presignedReadUrl(objectKey: string, expiresSeconds = 3600) {
  return minio.presignedGetObject(config.MINIO_BUCKET, objectKey, expiresSeconds)
}
