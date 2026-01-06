import { NextResponse } from 'next/server'
import { getScrapeStatus } from '../../../../../lib/scrape-status'

export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  return !!secret && auth === `Bearer ${secret}`
}

export async function GET(req: Request, { params }: { params: { jobId: string } }) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const status = getScrapeStatus(params.jobId)
  if (!status) {
    return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json(status)
}
