import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin/auth'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const configs = await prisma.siteConfig.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json({ configs })
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { key, value, label } = await req.json()
  if (!key || value === undefined) return NextResponse.json({ error: 'Missing key or value' }, { status: 400 })
  const config = await prisma.siteConfig.upsert({
    where: { key },
    update: { value, label },
    create: { key, value, label },
  })
  return NextResponse.json({ ok: true, config })
}

export async function DELETE(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { key } = await req.json()
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  await prisma.siteConfig.delete({ where: { key } })
  return NextResponse.json({ ok: true })
}
