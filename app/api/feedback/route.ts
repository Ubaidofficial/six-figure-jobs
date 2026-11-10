// app/api/feedback/route.ts
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

import { clientIp } from '../../../lib/auth/signInRateLimit'
import { createRateLimiter } from '../../../lib/jobs/jobReport'
import { prisma } from '../../../lib/prisma'

export const dynamic = 'force-dynamic'

// Anyone can post feedback, so a brake on flooding: per client IP (hashed, in memory, like the other limiters).
const limiter = createRateLimiter()
const LIMIT = { count: 6, windowMs: 10 * 60 * 1000 }
// A pasted screenshot arrives shrunk by the widget (JPEG, at most 1600px wide, usually 100-400 KB).
const SCREENSHOT = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/
const MAX_SCREENSHOT_CHARS = 3_000_000

interface FeedbackBody {
  type: string
  message: string
  screenshot?: string | null
  url?: string
}

export async function POST(req: Request) {
  // Cloudflare's header names the visitor; without it the proxy chain's address is used (see clientIp).
  const ip = req.headers.get('cf-connecting-ip')?.trim() || clientIp(req.headers)
  const ipKey = createHash('sha256').update(`sfj-feedback:${ip}`).digest('hex').slice(0, 32)
  if (!limiter.allow(ipKey, LIMIT.count, LIMIT.windowMs)) {
    return NextResponse.json({ error: 'Too many messages, try again later' }, { status: 429 })
  }

  try {
    const body: FeedbackBody = await req.json()
    const { type, message, url } = body
    const screenshot =
      typeof body.screenshot === 'string' && body.screenshot.length <= MAX_SCREENSHOT_CHARS && SCREENSHOT.test(body.screenshot)
        ? body.screenshot
        : null

    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      return NextResponse.json({ error: 'Message too short' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') ?? undefined

    const saved = await prisma.feedback.create({
      data: {
        type: typeof type === 'string' ? type.slice(0, 40) : 'other',
        message: message.trim().slice(0, 5000),
        url: typeof url === 'string' ? url.slice(0, 500) : null,
        hasScreenshot: Boolean(screenshot),
        userAgent: userAgent?.slice(0, 500) ?? null,
        status: 'new',
      },
      // Only the id: the row is written without the screenshot column, so this works before its migration is applied.
      select: { id: true },
    })

    // The screenshot in a second write, so a failure here (e.g. the column not migrated yet) never loses the feedback.
    if (screenshot) {
      await prisma.feedback
        .update({ where: { id: saved.id }, data: { screenshot }, select: { id: true } })
        .catch((err) => console.error('[feedback] screenshot not saved:', err instanceof Error ? err.message.split('\n').pop() : err))
    }

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
