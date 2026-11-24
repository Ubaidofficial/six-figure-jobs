// Jobs the owner expired by hand in the admin console. The import reactivates an expired job when its source still
// lists it (lib/ingest/index.ts refreshJob sets isExpired false), which is right for jobs the checks expired, but it
// undid a manual "Expire" on the next sync: a reported scam job came back live with its reports already resolved
// (found 2026-11-24). The ids are kept in SiteConfig (no migration), newest last, at most MAX_IDS; "Restore" removes one.
import { prisma } from '../prisma'

export const ADMIN_EXPIRED_KEY = 'admin.expired.jobIds'
export const MAX_IDS = 20_000
const CACHE_MS = 5 * 60_000

let cache: { at: number; ids: Set<string> } | null = null

function parse(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

async function load(): Promise<string[]> {
  const row = await prisma.siteConfig.findUnique({ where: { key: ADMIN_EXPIRED_KEY } })
  return parse(row?.value)
}

async function save(ids: string[]): Promise<void> {
  const value = JSON.stringify(ids.slice(-MAX_IDS))
  await prisma.siteConfig.upsert({ where: { key: ADMIN_EXPIRED_KEY }, update: { value }, create: { key: ADMIN_EXPIRED_KEY, value } })
  cache = { at: Date.now(), ids: new Set(ids.slice(-MAX_IDS)) }
}

export async function markAdminExpired(id: string): Promise<void> {
  const ids = (await load()).filter((x) => x !== id)
  ids.push(id)
  await save(ids)
}

export async function unmarkAdminExpired(id: string): Promise<void> {
  const ids = await load()
  if (ids.includes(id)) await save(ids.filter((x) => x !== id))
}

/** True when the owner expired this job by hand. Read at most every 5 minutes; a failure counts as "no". */
export async function isAdminExpired(id: string, now: number = Date.now()): Promise<boolean> {
  try {
    if (!cache || now - cache.at > CACHE_MS) cache = { at: now, ids: new Set(await load()) }
    return cache.ids.has(id)
  } catch {
    return false
  }
}

export function __resetAdminExpiredCacheForTests() {
  cache = null
}
