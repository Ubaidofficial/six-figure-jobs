import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin/auth'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const status = searchParams.get('status') || ''
  const severity = searchParams.get('severity') || ''
  const pageSize = 50

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (severity) where.severity = severity

  const [items, total] = await Promise.all([
    prisma.errorLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.errorLog.count({ where }),
  ])
  return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

export async function PATCH(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, status } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
  const item = await prisma.errorLog.update({ where: { id }, data: { status } })
  return NextResponse.json({ ok: true, item })
}
