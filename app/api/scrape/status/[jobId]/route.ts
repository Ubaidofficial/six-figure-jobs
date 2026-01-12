import { NextResponse } from 'next/server'
import { getScrapeStatus } from '../../../../../lib/scrape-status'

export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const auth = req.headers.get('authorization')
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_NEXT].filter(Boolean)
  if (!auth || secrets.length === 0) return false
  return secrets.some((s) => auth === `Bearer ${s}`)
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = await params

  const status = getScrapeStatus(jobId)
  if (!status) {
    return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json(status)
}
