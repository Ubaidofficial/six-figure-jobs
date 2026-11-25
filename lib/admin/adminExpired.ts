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

/**
 * Read, change and write the list under a row lock, so two admin actions at once (two tabs, "Expire" on several jobs)
 * cannot each write a list without the other's id.
 */
async function updateIds(change: (ids: string[]) => string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Create the row if missing without racing another first write (Prisma's upsert is a read then a write).
    await tx.$executeRaw`INSERT INTO "SiteConfig" ("key", "value", "updatedAt") VALUES (${ADMIN_EXPIRED_KEY}, '[]', now()) ON CONFLICT ("key") DO NOTHING`
    const rows = await tx.$queryRaw<Array<{ value: string }>>`SELECT "value" FROM "SiteConfig" WHERE "key" = ${ADMIN_EXPIRED_KEY} FOR UPDATE`
    const before = parse(rows[0]?.value)
    const after = change(before).slice(-MAX_IDS)
    if (after.length === before.length && after.every((x, i) => x === before[i])) return
    await tx.siteConfig.update({ where: { key: ADMIN_EXPIRED_KEY }, data: { value: JSON.stringify(after) } })
  })
  cache = null
}

/** One id, or several in one write (the Review queue's bulk "Expire"). */
export async function markAdminExpired(id: string | string[]): Promise<void> {
  const add = new Set(Array.isArray(id) ? id : [id])
  await updateIds((ids) => [...ids.filter((x) => !add.has(x)), ...add])
}

export async function unmarkAdminExpired(id: string): Promise<void> {
  await updateIds((ids) => ids.filter((x) => x !== id))
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
