const prismaMock = {
  jobAlert: { findMany: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn() },
  user: { findFirst: jest.fn() },
  job: { count: jest.fn(), findMany: jest.fn() },
  jobAlertSent: { findMany: jest.fn() },
}
jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
const hasActiveSubscription = jest.fn()
jest.mock('@/lib/billing/entitlement', () => ({ hasActiveSubscription: (...a: unknown[]) => hasActiveSubscription(...a) }))

import { DIGEST_SIZE, DUE_AFTER_MS, FREE_MAX_ALERTS_PER_EMAIL, PRO_MAX_ALERTS_PER_EMAIL } from '@/lib/alerts/config'
import { asFrequency, buildConfirmationEmail, buildDigestEmail, isDue } from '@/lib/alerts/digest'
import { runDigests, subscribe } from '@/lib/alerts/service'

const FILTERS = { roleSlugs: ['data-engineer'] }
const links = { manage: 'https://x.test/alerts/t', unsubscribe: 'https://x.test/api/alerts/t', search: 'https://x.test/jobs' }

describe('instant frequency', () => {
  it('is a frequency of its own, due again after about ten minutes', () => {
    expect(asFrequency('instant')).toBe('instant')
    expect(asFrequency('anything else')).toBe('weekly')
    const now = new Date('2026-11-15T12:00:00Z')
    expect(isDue({ frequency: 'instant', lastSentAt: new Date(now.getTime() - 5 * 60_000) }, now)).toBe(false)
    expect(isDue({ frequency: 'instant', lastSentAt: new Date(now.getTime() - DUE_AFTER_MS.instant) }, now)).toBe(true)
    expect(DIGEST_SIZE.instant).toBeGreaterThan(0)
  })

  it('says "instantly" in the emails, not "instant"', () => {
    const confirmation = buildConfirmationEmail({ label: 'Data Engineer jobs', frequency: 'instant', links, postalAddress: 'A St' })
    expect(confirmation.text).toContain('Data Engineer jobs, instantly.')
    const digest = buildDigestEmail({
      label: 'Data Engineer jobs',
      frequency: 'instant',
      jobs: [{ id: '1', title: 'Data Engineer', company: 'Acme', salary: '$150k', location: 'Remote', url: 'https://x.test/job/1' }],
      totalNew: 1,
      links,
      postalAddress: 'A St',
    })
    expect(digest.text).toContain('You get this instantly because')
  })

  it('free tier holds fewer searches than Pro', () => {
    expect(FREE_MAX_ALERTS_PER_EMAIL).toBeLessThan(PRO_MAX_ALERTS_PER_EMAIL)
  })
})

describe('subscribe', () => {
  beforeEach(() => jest.clearAllMocks())

  it('refuses an instant alert unless the caller verified a subscriber, before touching the database', async () => {
    const result = await subscribe({ email: 'a@b.com', filters: FILTERS, frequency: 'instant' })
    expect(result).toBe('pro_required')
    expect(prismaMock.jobAlert.findUnique).not.toHaveBeenCalled()
  })

  it('applies the free cap to new alerts and the higher cap to Pro', async () => {
    prismaMock.jobAlert.findUnique.mockResolvedValue(null)
    prismaMock.jobAlert.count.mockResolvedValue(FREE_MAX_ALERTS_PER_EMAIL)
    expect(await subscribe({ email: 'a@b.com', filters: FILTERS, frequency: 'weekly' })).toBe('limited')
    // Pro holding the free cap's worth is not limited: the alert is created and the confirmation mailed.
    prismaMock.jobAlert.create.mockResolvedValue({ token: 't'.repeat(64) })
    const send = jest.fn()
    expect(await subscribe({ email: 'c@d.com', filters: FILTERS, frequency: 'instant', pro: true, send })).toBe('confirmation_sent')
    expect(prismaMock.jobAlert.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ frequency: 'instant' }) }))
    expect(send).toHaveBeenCalledTimes(1)
    // ... but only up to the Pro ceiling.
    prismaMock.jobAlert.count.mockResolvedValue(PRO_MAX_ALERTS_PER_EMAIL)
    expect(await subscribe({ email: 'e@f.com', filters: FILTERS, frequency: 'weekly', pro: true })).toBe('limited')
  })
})

describe('runDigests with instant alerts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('moves an instant alert to daily when its owner is not a subscriber, and sends nothing for it', async () => {
    prismaMock.jobAlert.findMany.mockResolvedValue([
      { id: 'a1', email: 'x@y.com', frequency: 'instant', status: 'active', lastSentAt: null, confirmedAt: null, token: 't', filters: FILTERS },
    ])
    prismaMock.user.findFirst.mockResolvedValue(null)
    const send = jest.fn()
    const stats = await runDigests({ frequencies: ['instant'], send })
    expect(stats.demoted).toBe(1)
    expect(stats.sent).toBe(0)
    expect(send).not.toHaveBeenCalled()
    expect(prismaMock.jobAlert.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['a1'] } }, data: { frequency: 'daily' } })
    expect(prismaMock.jobAlert.findMany).toHaveBeenCalledWith({ where: { status: 'active', frequency: { in: ['instant'] } } })
  })

  it('keeps an instant alert for an active subscriber and records nothing in a dry run', async () => {
    prismaMock.jobAlert.findMany.mockResolvedValue([
      { id: 'a2', email: 'x@y.com', frequency: 'instant', status: 'active', lastSentAt: null, confirmedAt: null, token: 't', filters: FILTERS },
    ])
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1' })
    hasActiveSubscription.mockResolvedValue(true)
    prismaMock.job.count.mockResolvedValue(0)
    prismaMock.job.findMany.mockResolvedValue([])
    prismaMock.jobAlertSent.findMany.mockResolvedValue([])
    const stats = await runDigests({ frequencies: ['instant'], send: jest.fn(), dryRun: true })
    expect(stats.demoted).toBe(0)
    expect(stats.nothingNew).toBe(1)
    expect(prismaMock.jobAlert.updateMany).not.toHaveBeenCalled()
  })

  it('by default handles only daily and weekly alerts', async () => {
    prismaMock.jobAlert.findMany.mockResolvedValue([])
    await runDigests({ send: jest.fn() })
    expect(prismaMock.jobAlert.findMany).toHaveBeenCalledWith({ where: { status: 'active', frequency: { in: ['daily', 'weekly'] } } })
  })
})
