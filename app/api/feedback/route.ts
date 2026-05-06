// app/api/feedback/route.ts
// Receives feedback submissions from the floating FeedbackWidget.
// Currently logs to console and optionally sends to an email/webhook.

import { NextResponse } from 'next/server'

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

    // Log to server console (always available)
    console.log('[feedback]', {
      type,
      message: message.slice(0, 500),
      url,
      hasScreenshot: Boolean(screenshot),
      timestamp: new Date().toISOString(),
    })

    // Optional: forward to a webhook (set FEEDBACK_WEBHOOK_URL env var)
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
      }).catch(() => {
        // Don't fail if webhook fails
      })
    }

    // Optional: send email via FEEDBACK_EMAIL env var (requires email service)
    // Currently just logs. Wire up SendGrid/Resend/etc. as needed.

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[feedback] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
