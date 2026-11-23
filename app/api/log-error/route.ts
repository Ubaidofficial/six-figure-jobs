import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { errorGroupKey, isNoiseError } from '../../../lib/admin/errorReports'
import { clientIp } from '../../../lib/auth/signInRateLimit'
import { createRateLimiter } from '../../../lib/jobs/jobReport'
import { prisma } from '../../../lib/prisma'

export const dynamic = 'force-dynamic'

// Anyone can post here (the browser reporter has no session), so: known noise is dropped (lib/admin/errorReports.ts),
// one client may send 20 reports in 10 minutes, and one error is stored at most 100 times an hour across all
// clients (a loop on a popular page would otherwise fill the table). In memory, per server instance; keys are hashed.
const limiter = createRateLimiter()
const PER_CLIENT = { limit: 20, windowMs: 10 * 60 * 1000 }
const PER_ERROR = { limit: 100, windowMs: 60 * 60 * 1000 }

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24)

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { message, stack, url, context, severity } = body
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const filename = context && typeof context === 'object' ? String((context as { filename?: unknown }).filename ?? '') : ''
    if (isNoiseError(message, typeof stack === 'string' ? stack : null, filename)) {
      return NextResponse.json({ ok: true, stored: false })
    }
    if (
      !limiter.allow(`c:${hash(`sfj-log-error:${clientIp(req.headers)}`)}`, PER_CLIENT.limit, PER_CLIENT.windowMs) ||
      !limiter.allow(`e:${hash(errorGroupKey(message))}`, PER_ERROR.limit, PER_ERROR.windowMs)
    ) {
      return NextResponse.json({ ok: true, stored: false })
    }
    const userAgent = req.headers.get('user-agent') ?? undefined
    await prisma.errorLog.create({
      data: {
        message: String(message).slice(0, 1000),
        stack: stack ? String(stack).slice(0, 5000) : null,
        url: url ? String(url).slice(0, 500) : null,
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
        context: context ? JSON.stringify(context).slice(0, 2000) : null,
        severity: ['error', 'warning', 'info'].includes(severity) ? severity : 'error',
        status: 'new',
      },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
