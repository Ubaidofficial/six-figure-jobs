// app/api/apply-click/route.ts
// Counts a click on an Apply button (see lib/analytics/applyClick.ts for what is and is not stored). Always answers
// 204, so the response can never be used to probe for jobs, and a failure here never affects the visitor.
import { createHash } from 'node:crypto'

import { prisma } from '../../../lib/prisma'
import { isBotUserAgent, validateApplyClick } from '../../../lib/analytics/applyClick'
import { createRateLimiter } from '../../../lib/jobs/jobReport'

export const dynamic = 'force-dynamic'

const limiter = createRateLimiter()
const TEN_MINUTES = 10 * 60 * 1000
const noContent = () => new Response(null, { status: 204 })

export async function POST(req: Request) {
  try {
    const userAgent = req.headers.get('user-agent')
    if (isBotUserAgent(userAgent)) return noContent()

    // Beacons are sent as application/json blobs; fall back to text so a mis-typed beacon still parses.
    const click = validateApplyClick(JSON.parse(await req.text()))
    if (!click) return noContent()

    // One count per visitor per job per 10 minutes. The key is a hash held only in memory.
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    const key = createHash('sha256').update(`sfj-apply:${ip}|${userAgent}|${click.jobId}`).digest('hex').slice(0, 24)
    if (!limiter.allow(key, 1, TEN_MINUTES)) return noContent()

    const job = await prisma.job.findUnique({ where: { id: click.jobId }, select: { id: true } })
    if (!job) return noContent()

    await prisma.applyClick.create({ data: { jobId: click.jobId, surface: click.surface, device: click.device } })
  } catch (err) {
    // Includes "table does not exist" before the migration has been applied. Never surface it to the visitor.
    console.error('[apply-click]', err instanceof Error ? err.message.split('\n').pop() : err)
  }
  return noContent()
}
