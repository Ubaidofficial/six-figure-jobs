import { NextResponse } from 'next/server'
import { forgetMemo } from '../../../../lib/cache/memo'

import { getAdminSession } from '../../../../lib/admin/auth'
import { errorGroupKey, groupErrorReports } from '../../../../lib/admin/errorReports'
import { prisma } from '../../../../lib/prisma'
import { loadErrorRows } from '../../../ubaid93/(dashboard)/errors/groups'

export const dynamic = 'force-dynamic'

const STATUSES = new Set(['new', 'resolved'])

/**
 * Sets the status of every report of one issue (`key`, from errorGroupKey), or of all known noise (`noise: true`),
 * within the console's window. One report by `id` still works.
 */
export async function PATCH(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; key?: unknown; noise?: unknown; status?: unknown }
  const status = typeof body.status === 'string' && STATUSES.has(body.status) ? body.status : null
  if (!status) return NextResponse.json({ error: 'status must be new or resolved' }, { status: 400 })

  let ids: string[]
  if (typeof body.id === 'string') ids = [body.id]
  else if (typeof body.key === 'string' || body.noise === true) {
    const rows = await loadErrorRows(undefined, 300)
    ids =
      body.noise === true
        ? groupErrorReports(rows).filter((g) => g.noise).flatMap((g) => g.ids)
        : rows.filter((r) => errorGroupKey(r.message) === body.key).map((r) => r.id)
  } else return NextResponse.json({ error: 'Send id, key or noise' }, { status: 400 })

  const { count } = await prisma.errorLog.updateMany({ where: { id: { in: ids }, status: { not: status } }, data: { status } })
  forgetMemo('admin:error-badge') // the navigation count, so it is right on the next page
  return NextResponse.json({ ok: true, updated: count })
}
