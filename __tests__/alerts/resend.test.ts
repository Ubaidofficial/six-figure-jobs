jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { alertsEnabled } from '@/lib/alerts/config'
import { SendLimitError, sendViaResend } from '@/lib/alerts/service'

const mail = {
  to: 'jane@example.com',
  subject: '2 new Data Engineer jobs',
  text: 'text',
  html: '<p>html</p>',
  headers: { 'List-Unsubscribe': '<https://www.6figjobs.com/api/alerts/x>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
}
const reply = (status: number, body = '{}') => new Response(body, { status })

describe('sending through Resend', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }))
  afterEach(() => jest.useRealTimers())

  it('posts one email with its unsubscribe headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200, '{"id":"abc"}'))
    await sendViaResend(mail, 're_key', 'Six Figure Jobs <alerts@6figjobs.com>', fetchImpl as never)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_key')
    expect(JSON.parse(init.body)).toEqual({
      from: 'Six Figure Jobs <alerts@6figjobs.com>',
      to: ['jane@example.com'],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: mail.headers,
    })
  })

  it('retries a 429 once, then reports the sending limit', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(429))
    const done = sendViaResend(mail, 'k', 'f', fetchImpl as never)
    const settled = expect(done).rejects.toBeInstanceOf(SendLimitError)
    await jest.advanceTimersByTimeAsync(2000)
    await settled
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('goes through when the retry succeeds', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(reply(429)).mockResolvedValueOnce(reply(200))
    const done = sendViaResend(mail, 'k', 'f', fetchImpl as never)
    await jest.advanceTimersByTimeAsync(2000)
    await expect(done).resolves.toBeUndefined()
  })

  it('reports other refusals without the response body (it can echo the address)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(422, '{"message":"jane@example.com is invalid"}'))
    await expect(sendViaResend(mail, 'k', 'f', fetchImpl as never)).rejects.toThrow('email provider refused the email (HTTP 422)')
    await expect(sendViaResend(mail, 'k', 'f', fetchImpl as never)).rejects.not.toThrow(/jane/)
  })
})

describe('alerts switch with Resend', () => {
  const base = { ALERTS_ENABLED: 'true', EMAIL_FROM: 'a@b.c', ALERTS_POSTAL_ADDRESS: '1 Main St' }
  it('is on with a Resend key or an SMTP server', () => {
    expect(alertsEnabled({ ...base, RESEND_API_KEY: 're_x' })).toBe(true)
    expect(alertsEnabled({ ...base, EMAIL_SERVER: 'smtp://x' })).toBe(true)
    expect(alertsEnabled(base)).toBe(false)
  })
})
