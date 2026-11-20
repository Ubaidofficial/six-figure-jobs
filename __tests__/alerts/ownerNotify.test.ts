const prismaMock = { jobAlert: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() } }
jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
jest.mock('@/lib/billing/entitlement', () => ({ hasActiveSubscription: jest.fn() }))

import { applyAlertAction, maskEmail } from '@/lib/alerts/service'

const TOKEN = 'a'.repeat(64)
const alert = (over: Record<string, unknown> = {}) => ({
  id: 'al1', token: TOKEN, email: 'jane.doe@example.com', filters: { roleSlugs: ['data-engineer'] }, frequency: 'weekly',
  source: '/jobs', status: 'pending', confirmedAt: null, unsubscribedAt: null, ...over,
})

describe('owner notification on a new job alert subscriber', () => {
  const send = jest.fn()
  beforeEach(() => {
    send.mockReset().mockResolvedValue(undefined)
    prismaMock.jobAlert.update.mockReset().mockResolvedValue({})
    prismaMock.jobAlert.count.mockReset().mockResolvedValue(42)
    process.env.ALERTS_OWNER_EMAIL = 'owner@example.test'
  })
  afterAll(() => delete process.env.ALERTS_OWNER_EMAIL)

  it('emails the owner once, on the first confirmation, with the subscriber masked', async () => {
    prismaMock.jobAlert.findUnique.mockResolvedValue(alert())
    expect(await applyAlertAction(TOKEN, 'confirm', new Date(), send)).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    const mail = send.mock.calls[0][0]
    expect(mail.to).toBe('owner@example.test')
    expect(mail.subject).toMatch(/^New job alert subscriber: /)
    expect(mail.text).toContain('j***@example.com')
    expect(mail.text).not.toContain('jane.doe')
    expect(mail.text).toContain('Frequency: weekly')
    expect(mail.text).toContain('Active alerts now: 42')
  })

  it('does not email again for an alert confirmed before, or for other actions', async () => {
    prismaMock.jobAlert.findUnique.mockResolvedValue(alert({ status: 'active', confirmedAt: new Date('2026-11-01') }))
    await applyAlertAction(TOKEN, 'confirm', new Date(), send)
    prismaMock.jobAlert.findUnique.mockResolvedValue(alert())
    await applyAlertAction(TOKEN, 'unsubscribe', new Date(), send)
    await applyAlertAction(TOKEN, 'daily', new Date(), send)
    expect(send).not.toHaveBeenCalled()
  })

  it('sends nothing without ALERTS_OWNER_EMAIL, and a failed send never stops the confirmation', async () => {
    prismaMock.jobAlert.findUnique.mockResolvedValue(alert())
    delete process.env.ALERTS_OWNER_EMAIL
    expect(await applyAlertAction(TOKEN, 'confirm', new Date(), send)).toBe(true)
    expect(send).not.toHaveBeenCalled()

    process.env.ALERTS_OWNER_EMAIL = 'owner@example.test'
    send.mockRejectedValue(new Error('provider down'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(await applyAlertAction(TOKEN, 'confirm', new Date(), send)).toBe(true)
    expect(prismaMock.jobAlert.update).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('masks addresses', () => {
    expect(maskEmail('jane.doe@gmail.com')).toBe('j***@gmail.com')
    expect(maskEmail('nope')).toBe('***')
  })
})
