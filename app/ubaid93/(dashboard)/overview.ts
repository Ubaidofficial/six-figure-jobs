// The daily figures of the admin Overview and Apply clicks pages; the health checks live in lib/admin/health.ts (the
// alert emails use them too). Every query is a read.
import { prisma } from '../../../lib/prisma'

export { loadHealthChecks, type Check } from '../../../lib/admin/health'

export type Daily = { days: string[]; added: number[]; expired: number[]; clicks: number[] }

export async function loadDaily(days: string[]): Promise<Daily> {
  const from = new Date(`${days[0]}T00:00:00Z`)
  const [added, expired, clicks] = await Promise.all([
    prisma.$queryRaw<Array<{ d: string; n: number }>>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "Job" WHERE "isExpired" IN (true, false) AND "createdAt" >= ${from} GROUP BY 1`,
    // Every expiry path stamps validThrough with the day it expired the job (lib/jobs/expiry.ts).
    prisma.$queryRaw<Array<{ d: string; n: number }>>`
      SELECT to_char(date_trunc('day', "validThrough" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "Job" WHERE "isExpired" = true AND "validThrough" >= ${from} GROUP BY 1`,
    prisma.$queryRaw<Array<{ d: string; n: number }>>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "ApplyClick" WHERE "createdAt" >= ${from} GROUP BY 1`.catch(() => []),
  ])
  const fill = (rows: Array<{ d: string; n: number }>) => {
    const m = new Map(rows.map((r) => [r.d, Number(r.n)]))
    return days.map((d) => m.get(d) ?? 0)
  }
  return { days, added: fill(added), expired: fill(expired), clicks: fill(clicks) }
}
