import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { message, stack, url, context, severity } = body
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const userAgent = req.headers.get('user-agent') ?? undefined
    await prisma.errorLog.create({
      data: {
        message: String(message).slice(0, 1000),
        stack: stack ? String(stack).slice(0, 5000) : null,
        url: url ? String(url).slice(0, 500) : null,
        userAgent: userAgent ?? null,
        context: context ? JSON.stringify(context).slice(0, 2000) : null,
        severity: ['error', 'warning', 'info'].includes(severity) ? severity : 'error',
        status: 'new',
      },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
