// app/api/alerts/route.ts
// POST /api/alerts { email, frequency, filters, source, website } -> { ok, message }
// Signs an address up for an email job alert (double opt-in: only a confirmation email is sent). The answer is the same
// whether or not the address already has alerts. 404 while alerts are off (lib/alerts/config.ts).
import { createHash } from 'node:crypto'

import { alertsEnabled, MAX_SIGNUPS_PER_IP_PER_10_MIN } from '@/lib/alerts/config'
import { normalizeEmail, subscribe } from '@/lib/alerts/service'
import { createRateLimiter } from '@/lib/jobs/jobReport'
import { accountsEnabled, notFoundResponse } from '@/lib/accounts/enabled'

export const dynamic = 'force-dynamic'

const limiter = createRateLimiter()
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

/** The signed-in visitor's address when they hold an active subscription, else null. Only this unlocks Pro alert features. */
async function signedInProEmail(): Promise<string | null> {
  if (!accountsEnabled()) return null
  const [{ getSessionUser }, { hasActiveSubscription }] = await Promise.all([
    import('@/lib/auth/session'),
    import('@/lib/billing/entitlement'),
  ])
  const user = await getSessionUser()
  if (!user?.email || !(await hasActiveSubscription(user.id))) return null
  return normalizeEmail(user.email)
}

const CHECK_INBOX = 'Check your inbox and click the link to confirm. If you already get this alert, nothing changes.'

export async function POST(req: Request) {
  if (!alertsEnabled()) return notFoundResponse()

  // Cloudflare's visitor address when present, else the first forwarded hop.
  const ip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const key = createHash('sha256').update(`sfj-alerts:${ip}`).digest('hex').slice(0, 24)
  if (!limiter.allow(key, MAX_SIGNUPS_PER_IP_PER_10_MIN, 10 * 60 * 1000)) {
    return json({ ok: false, message: 'Too many signups from here. Try again in a few minutes.' }, 429)
  }

  let body: Record<string, unknown>
  try {
    const text = await req.text()
    if (text.length > 8_000) return json({ ok: false, message: 'Invalid request.' }, 400)
    body = JSON.parse(text)
  } catch {
    return json({ ok: false, message: 'Invalid request.' }, 400)
  }

  // Hidden field people never see; form-filling bots do. Answered like a success so they learn nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') return json({ ok: true, message: CHECK_INBOX })

  try {
    // Pro only when the signed-in subscriber is signing up their own address; someone else's address stays free-tier.
    const proEmail = await signedInProEmail()
    const email = normalizeEmail(body.email)
    const result = await subscribe({
      email: body.email,
      filters: body.filters,
      frequency: body.frequency,
      source: body.source,
      pro: proEmail !== null && proEmail === email,
    })
    if (result === 'invalid') return json({ ok: false, message: 'Enter a valid email address.' }, 400)
    if (result === 'pro_required') {
      return json({ ok: false, message: 'Instant alerts are part of Pro. Sign in with the same email and subscribe at /pricing, or choose daily or weekly.' }, 402)
    }
    return json({ ok: true, message: CHECK_INBOX })
  } catch (err) {
    console.error('[alerts] signup failed', err instanceof Error ? err.message.split('\n').pop() : err)
    return json({ ok: false, message: 'Something went wrong. Please try again later.' }, 503)
  }
}
