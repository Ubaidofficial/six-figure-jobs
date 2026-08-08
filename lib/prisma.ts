// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function addUrlParam(url: string, key: string, value: string | undefined): string {
  if (!url || !value) return url
  const pattern = new RegExp(`[?&]${key}=`)
  if (pattern.test(url)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${key}=${encodeURIComponent(value)}`
}

const isProductionRuntime = process.env.NODE_ENV === 'production'
const preferDatabaseUrl = !isProductionRuntime || process.env.PRISMA_PREFER_DATABASE_URL === '1'

const baseUrl = preferDatabaseUrl
  ? process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || ''
  : process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || ''

const pooledUrl = addUrlParam(
  addUrlParam(
    baseUrl,
    'connection_limit',
    process.env.PRISMA_CONNECTION_LIMIT ?? (isProductionRuntime ? '15' : '5'),
  ),
  'pool_timeout',
  process.env.PRISMA_POOL_TIMEOUT ?? '10',
)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: baseUrl ? { db: { url: pooledUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
