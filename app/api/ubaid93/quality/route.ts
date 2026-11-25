import { NextResponse } from 'next/server'

import { getAdminSession } from '../../../../lib/admin/auth'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

/** The owner marks a finding "won't fix" (the quality agents then leave it alone) or reopens it. */
export async function PATCH(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { key, status } = await req.json().catch(() => ({}))
  if (typeof key !== 'string' || !key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  if (status !== 'wontfix' && status !== 'open') return NextResponse.json({ error: 'status must be wontfix or open' }, { status: 400 })
  const found = await prisma.qualityFinding.findUnique({ where: { key }, select: { id: true } })
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.qualityFinding.update({
    where: { key },
    data: { status, note: status === 'wontfix' ? "Marked won't fix by the owner." : null },
  })
  return NextResponse.json({ ok: true })
}
