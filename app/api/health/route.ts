// GET /api/health -> 200 { ok: true } when the database answers and holds live jobs, otherwise 503.
// For the host's health check and uptime monitors. On 2026-11-13 a deploy pointed the app at a database it could not
// use: every page still answered 200 (0 jobs, job pages "temporarily unavailable" with noindex) for about three hours,
// so nothing noticed. This answers 503 in that state.
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET() {
  const started = Date.now()
  try {
    const rows = await prisma.$queryRaw<unknown[]>`SELECT 1 FROM "Job" WHERE "isExpired" = false LIMIT 1`
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'no live jobs' }, { status: 503, headers: NO_STORE })
    }
    return NextResponse.json({ ok: true, dbMs: Date.now() - started }, { headers: NO_STORE })
  } catch (error) {
    // Only the error's class and Prisma code: the message can contain the database host.
    const code = (error as { code?: string })?.code
    console.error('[health] database check failed', code ?? (error as Error)?.name)
    return NextResponse.json({ ok: false, error: 'database unavailable', code }, { status: 503, headers: NO_STORE })
  }
}
