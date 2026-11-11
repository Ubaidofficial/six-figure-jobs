// app/api/report-job/route.ts
// Visitor reports about a job. Stored in Feedback (see lib/jobs/jobReport.ts). Public endpoint, so: fixed reasons,
// the job must exist, honeypot field, and an in-memory rate limit (per visitor and per visitor+job).
import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { prisma } from '../../../lib/prisma'
import {
  JOB_REPORT_REASONS,
  buildReportMessage,
  createRateLimiter,
  validateJobReport,
} from '../../../lib/jobs/jobReport'
import { getSiteUrl } from '../../../lib/seo/site'
import { jobByClientId } from '../../../lib/jobs/publicJob'

export const dynamic = 'force-dynamic'

// Rate-limit keys are hashed, so no IP address is held or stored.
const hashForLimit = (value: string) => createHash('sha256').update(`sfj-report:${value}`).digest('hex').slice(0, 24)

const limiter = createRateLimiter()
const HOUR = 60 * 60 * 1000

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const parsed = validateJobReport(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (parsed.honeypot) return NextResponse.json({ ok: true })
  const { report } = parsed

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const visitor = hashForLimit(`${ip}|${req.headers.get('user-agent') ?? ''}`)
  if (!limiter.allow(`v:${visitor}`, 10, HOUR) || !limiter.allow(`j:${visitor}:${report.jobId}`, 1, 24 * HOUR)) {
    return NextResponse.json({ error: 'You have already reported this. Thank you.' }, { status: 429 })
  }

  try {
    // The page sends the job's public id (the code in its URL), or the internal id from an older page.
    const job = await prisma.job.findFirst({
      where: jobByClientId(report.jobId),
      select: { id: true, title: true, company: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const message = buildReportMessage(report, job)
    await prisma.feedback.create({
      data: {
        type: JOB_REPORT_REASONS[report.reason].type,
        message,
        url: report.path ? `${getSiteUrl()}${report.path}` : null,
        hasScreenshot: false,
        userAgent: req.headers.get('user-agent') ?? null,
        status: 'new',
      },
    })

    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `*Job report*\n${message}${report.path ? `\n${getSiteUrl()}${report.path}` : ''}` }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[report-job] error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
