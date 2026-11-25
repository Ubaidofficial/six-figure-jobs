import { NextResponse } from 'next/server'

import { getAdminSession } from '../../../../../lib/admin/auth'
import { checkEmployer } from '../../../../../lib/admin/employerCheck'
import { makeBoardSource } from '../../../../../lib/ingest/sourcePriority'
import { prisma } from '../../../../../lib/prisma'
import { lookupFreehireJob } from '../../../../../lib/scrapers/freehireClosedCheck'

export const dynamic = 'force-dynamic'

/** "Check employer" in the Review queue: whether the job still looks open where it was posted (lib/admin/employerCheck.ts). Reads only. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const job = await prisma.job.findUnique({ where: { id }, select: { applyUrl: true, url: true, source: true, sourceRef: true } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const result = await checkEmployer(
    { applyUrl: job.applyUrl, url: job.url, freehireSlug: job.source === makeBoardSource('freehire') ? job.sourceRef : null },
    { lookupFreehire: lookupFreehireJob },
  )
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
