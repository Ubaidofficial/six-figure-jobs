import { isDailyQuotaError } from '../../lib/indexing/googleIndexingClient'

const apiError = (status: number, body: string) => Object.assign(new Error(`Indexing API error status=${status} body=${body.slice(0, 240)}`), { status, body })

const DAILY = JSON.stringify({
  error: {
    code: 429,
    message: "Quota exceeded for quota metric 'Publish requests' and limit 'Publish requests per day' of service 'indexing.googleapis.com'",
    status: 'RESOURCE_EXHAUSTED',
  },
})
const PER_MINUTE = JSON.stringify({
  error: { code: 429, message: "Quota exceeded for quota metric 'Publish requests' and limit 'Publish requests per minute'", status: 'RESOURCE_EXHAUSTED' },
})

describe('isDailyQuotaError', () => {
  it('recognises the daily publish quota, which only comes back once a day', () => {
    expect(isDailyQuotaError(apiError(429, DAILY))).toBe(true)
  })

  it('leaves per-minute limits to the normal retry with backoff', () => {
    expect(isDailyQuotaError(apiError(429, PER_MINUTE))).toBe(false)
  })

  it('ignores other errors, even with "per day" in the text', () => {
    expect(isDailyQuotaError(apiError(503, DAILY))).toBe(false)
    expect(isDailyQuotaError(apiError(403, 'forbidden'))).toBe(false)
    expect(isDailyQuotaError(new Error('network down'))).toBe(false)
    expect(isDailyQuotaError(null)).toBe(false)
  })
})
