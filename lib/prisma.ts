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

/**
 * The database address to use. Production prefers POSTGRES_PRISMA_URL, development DATABASE_URL.
 *
 * While `next build` runs, BUILD_DATABASE_URL wins when set. The database lives on the same VPS as the app (Openship,
 * since 2026-11-14) and the app reaches it at its private address, but Openship's builder is not on that network: with
 * no database at build time, pages that fall back call `connection()` (lib/runtime/fallback.ts), which makes them
 * render on every request instead of from the ISR cache (the homepage lost its cache that way). The build therefore
 * reads through the database's public port, and the running app keeps the private address.
 */
export function pickDatabaseUrl(env: Record<string, string | undefined>): string {
  const buildUrl = env.NEXT_PHASE === 'phase-production-build' ? env.BUILD_DATABASE_URL?.trim() : ''
  if (buildUrl) return buildUrl
  const preferDatabaseUrl = env.NODE_ENV !== 'production' || env.PRISMA_PREFER_DATABASE_URL === '1'
  return preferDatabaseUrl
    ? env.DATABASE_URL || env.POSTGRES_PRISMA_URL || ''
    : env.POSTGRES_PRISMA_URL || env.DATABASE_URL || ''
}

const baseUrl = pickDatabaseUrl(process.env)

const pooledUrl = addUrlParam(
  addUrlParam(
    baseUrl,
    'connection_limit',
    process.env.PRISMA_CONNECTION_LIMIT ?? (isProductionRuntime ? '15' : '5'),
  ),
  'pool_timeout',
  process.env.PRISMA_POOL_TIMEOUT ?? '10',
)

// Off unless set (e.g. SLOW_QUERY_LOG_MS=3000): logs `[slow-query] <ms> <SQL without values>` for every query that took that long,
// to tell a database stall from a blocked server (see lib/runtime/stallWatch.ts). Off by default because subscribing to Prisma's
// query event makes it build an event, with every bound value, for each query, a cost not measured here for queries with very
// large lists.
const slowQueryMs = Number(process.env.SLOW_QUERY_LOG_MS) || 0

function createClient(): PrismaClient {
  const datasources = baseUrl ? { db: { url: pooledUrl } } : undefined
  if (!slowQueryMs) {
    return new PrismaClient({ datasources, log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] })
  }
  const client = new PrismaClient({ datasources, log: [{ emit: 'event', level: 'query' }, 'error'] })
  client.$on('query', (e) => {
    if (e.duration >= slowQueryMs) console.warn(`[slow-query] ${e.duration}ms ${e.query.replace(/\s+/g, ' ').slice(0, 300)}`)
  })
  return client as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
