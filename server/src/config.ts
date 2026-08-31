import 'dotenv/config'
import { z } from 'zod'

const booleanFromString = z.preprocess((value) => {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return false
  return value.toLowerCase() === 'true'
}, z.boolean())

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: booleanFromString.default(false),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default('shipping-ledger'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),

  DASHSCOPE_API_KEY: z.string().optional().default(''),
  DASHSCOPE_BASE_URL: z.string().optional().default(''),
  QWEN_MODEL: z.string().default('qwen3.8-flash')
})

export const config = envSchema.parse(process.env)
