import { NextResponse } from 'next/server'

import { getAdminSession } from '../../../../lib/admin/auth'
import { alertRecipient, emailConfigured } from '../../../../lib/admin/healthAlerts'
import { sendMail } from '../../../../lib/alerts/service'

export const dynamic = 'force-dynamic'

/** Sends one test email to the alert address, so the owner can see alerts will reach them. */
export async function POST() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const to = alertRecipient()
  if (!to) return NextResponse.json({ error: 'No alert address: set OPS_ALERT_EMAIL (or ALERTS_OWNER_EMAIL) in Openship.' }, { status: 400 })
  if (!emailConfigured()) return NextResponse.json({ error: 'No email provider: set RESEND_API_KEY and EMAIL_FROM in Openship.' }, { status: 400 })
  try {
    const text = 'This is a test of the Six Figure Jobs health alerts. When a check on the admin Overview turns red, an email like this one tells you which, and another tells you when it is fixed.'
    await sendMail({ to, subject: 'Six Figure Jobs: test health alert', text, html: `<p style="font:15px/1.5 system-ui,sans-serif">${text}</p>` })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.split('\n')[0] : 'Sending failed' }, { status: 502 })
  }
}
