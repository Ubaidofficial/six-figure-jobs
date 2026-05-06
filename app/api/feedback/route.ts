// app/api/feedback/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export const dynamic = 'force-dynamic'

interface FeedbackBody {
  type: string
  message: string
  screenshot?: string | null
  url?: string
}

export async function POST(req: Request) {
  try {
    const body: FeedbackBody = await req.json()
    const { type, message, screenshot, url } = body

    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      return NextResponse.json({ error: 'Message too short' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') ?? undefined

    await prisma.feedback.create({
      data: {
        type: type ?? 'other',
        message: message.trim().slice(0, 5000),
        url: url ?? null,
        hasScreenshot: Boolean(screenshot),
        userAgent: userAgent ?? null,
        status: 'new',
      },
    })

    // Optional webhook forward
    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL
    if (webhookUrl) {
      const text = [
        `*New feedback: ${type}*`,
        `*Page:* ${url ?? 'unknown'}`,
        `*Message:* ${message.trim()}`,
        screenshot ? `_[screenshot attached]_` : '',
      ]
        .filter(Boolean)
        .join('\n')

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[feedback] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
