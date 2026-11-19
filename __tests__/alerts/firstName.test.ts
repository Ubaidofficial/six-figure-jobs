const prismaMock = { jobAlert: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), create: jest.fn() } }
jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
jest.mock('@/lib/billing/entitlement', () => ({ hasActiveSubscription: jest.fn() }))

import { applyAlertAction, readFirstName, subscribe } from '@/lib/alerts/service'

describe('optional first name on job alerts', () => {
  const send = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    send.mockResolvedValue(undefined)
    prismaMock.jobAlert.findUnique.mockResolvedValue(null)
    prismaMock.jobAlert.count.mockResolvedValue(0)
    prismaMock.jobAlert.create.mockImplementation(async ({ data }) => ({ ...data, id: 'al1' }))
    prismaMock.jobAlert.update.mockImplementation(async ({ data }) => ({ ...data, id: 'al1', token: 'b'.repeat(64) }))
  })

  it('keeps names in any script, trimmed, and drops anything that is not a name', () => {
    expect(readFirstName('  Sam  ')).toBe('Sam')
    expect(readFirstName('Anne-Marie')).toBe('Anne-Marie')
    expect(readFirstName("D'Arcy")).toBe("D'Arcy")
    expect(readFirstName('José')).toBe('José')
    expect(readFirstName('Zoë Mary')).toBe('Zoë Mary')
    expect(readFirstName('Мария')).toBe('Мария')
    expect(readFirstName('محمد')).toBe('محمد')
    expect(readFirstName('')).toBeNull()
    expect(readFirstName('   ')).toBeNull()
    expect(readFirstName(undefined)).toBeNull()
    expect(readFirstName(42)).toBeNull()
    expect(readFirstName('Sam2')).toBeNull()
    expect(readFirstName('<b>Sam</b>')).toBeNull()
    expect(readFirstName('http://spam.example')).toBeNull()
    expect(readFirstName('=HYPERLINK("x")')).toBeNull()
    expect(readFirstName('-Sam')).toBeNull()
    expect(readFirstName('A'.repeat(41))).toBeNull()
    expect(readFirstName('A'.repeat(40))).toBe('A'.repeat(40))
  })

  it('stores the name with a new alert, and null when none or an unusable one is given', async () => {
    await subscribe({ email: 'sam@example.com', firstName: ' Sam ', filters: {}, frequency: 'weekly', send })
    expect(prismaMock.jobAlert.create.mock.calls[0][0].data.firstName).toBe('Sam')

    await subscribe({ email: 'kim@example.com', filters: {}, frequency: 'weekly', send })
    expect(prismaMock.jobAlert.create.mock.calls[1][0].data.firstName).toBeNull()

    await subscribe({ email: 'lee@example.com', firstName: '<script>', filters: {}, frequency: 'weekly', send })
    expect(prismaMock.jobAlert.create.mock.calls[2][0].data.firstName).toBeNull()
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('a renewed signup sets a newly given name and keeps the stored one when the field is left empty', async () => {
    prismaMock.jobAlert.findUnique.mockResolvedValue({ id: 'al1', status: 'unsubscribed', token: 'b'.repeat(64), firstName: 'Sam' })
    await subscribe({ email: 'pat@example.com', firstName: 'Pat', filters: {}, frequency: 'daily', send })
    expect(prismaMock.jobAlert.update.mock.calls[0][0].data).toEqual({ status: 'pending', frequency: 'daily', firstName: 'Pat' })

    await subscribe({ email: 'pat2@example.com', filters: {}, frequency: 'daily', send })
    expect(prismaMock.jobAlert.update.mock.calls[1][0].data).toEqual({ status: 'pending', frequency: 'daily' })
  })

  it('names the subscriber in the owner notice when they gave a name', async () => {
    process.env.ALERTS_OWNER_EMAIL = 'owner@example.test'
    prismaMock.jobAlert.count.mockResolvedValue(7)
    prismaMock.jobAlert.findUnique.mockResolvedValue({
      id: 'al1', token: 'a'.repeat(64), email: 'sam.lee@example.com', firstName: 'Sam', filters: {}, frequency: 'weekly',
      source: '/jobs', status: 'pending', confirmedAt: null, unsubscribedAt: null,
    })
    await applyAlertAction('a'.repeat(64), 'confirm', new Date(), send)
    expect(send.mock.calls[0][0].text).toContain('Sam (s***@example.com) confirmed a job alert.')
    delete process.env.ALERTS_OWNER_EMAIL
  })
})
