import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin/auth'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const q = searchParams.get('q') || ''
  const source = searchParams.get('source') || ''
  const expired = searchParams.get('expired')
  const pageSize = 50

  const where: Record<string, unknown> = {}
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { company: { contains: q, mode: 'insensitive' } }]
  if (source) where.source = source
  if (expired === '1') where.isExpired = true
  else if (expired === '0') where.isExpired = false

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      select: {
        id: true, title: true, company: true, source: true,
        salaryMin: true, salaryMax: true, salaryCurrency: true,
        isExpired: true, remote: true, postedAt: true, createdAt: true, applyUrl: true, url: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ])

  return NextResponse.json({ jobs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

export async function PATCH(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const allowed = ['title', 'company', 'salaryMin', 'salaryMax', 'salaryCurrency',
    'isExpired', 'remote', 'applyUrl', 'descriptionHtml']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in data) update[key] = data[key]
  }

  const job = await prisma.job.update({ where: { id }, data: update })
  return NextResponse.json({ ok: true, job })
}
