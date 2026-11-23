import { NextResponse } from 'next/server'

import { getAdminSession } from '../../../../lib/admin/auth'
import { JOB_REPORT_TYPES, reportMarker } from '../../../../lib/admin/jobReports'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'reviewed', 'resolved']

/** Sets the status of one message (`id`), or of every report about one job (`jobId`). */
export async function PATCH(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, jobId, status } = (await req.json().catch(() => ({}))) as { id?: unknown; jobId?: unknown; status?: unknown }
  if (typeof status !== 'string' || !STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Send a status of new, reviewed or resolved' }, { status: 400 })
  }
  if (typeof jobId === 'string' && jobId.length > 0 && jobId.length <= 80) {
    const { count } = await prisma.feedback.updateMany({
      where: { type: { in: JOB_REPORT_TYPES }, message: { contains: reportMarker(jobId) }, status: { not: status } },
      data: { status },
    })
    return NextResponse.json({ ok: true, updated: count })
  }
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Send id or jobId' }, { status: 400 })
  const item = await prisma.feedback.update({ where: { id }, data: { status }, select: { id: true, status: true } })
  return NextResponse.json({ ok: true, item })
}
