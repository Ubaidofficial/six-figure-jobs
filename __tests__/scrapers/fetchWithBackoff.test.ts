import {
  fetchWithBackoff,
  fetchJsonWithBackoff,
  __internals,
} from '../../lib/scrapers/utils/fetchWithBackoff'

const { parseRetryAfter, exponentialBackoff } = __internals

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

function makeResponse(status: number, body = '', headers: Record<string, string> = {}): Response {
  return new Response(body || null, { status, headers })
}

describe('parseRetryAfter', () => {
  it('parses integer seconds', () => {
    expect(parseRetryAfter('5')).toBe(5000)
    expect(parseRetryAfter('0')).toBe(0)
  })

  it('parses HTTP date relative to "now"', () => {
    const now = new Date('2026-06-09T12:00:00.000Z').getTime()
    const future = new Date('2026-06-09T12:00:15.000Z').toUTCString()
    expect(parseRetryAfter(future, now)).toBe(15_000)
  })

  it('clamps past dates to 0', () => {
    const now = new Date('2026-06-09T12:00:00.000Z').getTime()
    const past = new Date('2026-06-09T11:59:00.000Z').toUTCString()
    expect(parseRetryAfter(past, now)).toBe(0)
  })

  it('returns null for missing or invalid headers', () => {
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter('')).toBeNull()
    expect(parseRetryAfter('definitely-not-a-date')).toBeNull()
  })
})

describe('exponentialBackoff', () => {
  it('doubles each attempt and clamps to cap', () => {
    expect(exponentialBackoff(0, 500, 10_000)).toBe(500)
    expect(exponentialBackoff(1, 500, 10_000)).toBe(1000)
    expect(exponentialBackoff(2, 500, 10_000)).toBe(2000)
    expect(exponentialBackoff(10, 500, 10_000)).toBe(10_000)
  })
})

describe('fetchWithBackoff', () => {
  it('returns the response on first success', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, 'ok'))
    const res = await fetchWithBackoff('https://example.test/api')
    expect(res.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 and honors Retry-After (in seconds)', async () => {
    const retries: number[] = []
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(429, '', { 'retry-after': '0' }))
      .mockResolvedValueOnce(makeResponse(200, 'ok'))
    global.fetch = fetchMock

    const res = await fetchWithBackoff('https://example.test/api', {
      onRetry: (info) => retries.push(info.delayMs),
      baseDelayMs: 1,
    })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(retries).toEqual([0])
  })

  it('retries on 503 with exponential backoff when no Retry-After', async () => {
    const retries: number[] = []
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(200, 'ok'))
    global.fetch = fetchMock

    const res = await fetchWithBackoff('https://example.test/api', {
      onRetry: (info) => retries.push(info.delayMs),
      baseDelayMs: 1,
      maxDelayMs: 100,
    })

    expect(res.status).toBe(200)
    expect(retries).toEqual([1])
  })

  it('retries on 502/504 (gateway errors)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(502))
      .mockResolvedValueOnce(makeResponse(504))
      .mockResolvedValueOnce(makeResponse(200, 'ok'))
    global.fetch = fetchMock

    const res = await fetchWithBackoff('https://example.test/api', {
      baseDelayMs: 1,
    })
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does NOT retry on 500/501 (app errors)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse(500))
    global.fetch = fetchMock

    const res = await fetchWithBackoff('https://example.test/api', {
      attempts: 4,
      baseDelayMs: 1,
    })
    expect(res.status).toBe(500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries on network errors', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(makeResponse(200, 'ok'))
    global.fetch = fetchMock

    const res = await fetchWithBackoff('https://example.test/api', {
      baseDelayMs: 1,
    })
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting attempts on persistent network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'))

    await expect(
      fetchWithBackoff('https://example.test/api', { attempts: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('ECONNRESET')
  })

  it('returns the final 429 if attempts exhaust (caller decides)', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(429))
    const res = await fetchWithBackoff('https://example.test/api', {
      attempts: 2,
      baseDelayMs: 1,
    })
    expect(res.status).toBe(429)
  })
})

describe('fetchJsonWithBackoff', () => {
  it('parses JSON on success', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, JSON.stringify({ jobs: [{ id: 1 }] })))
    const data = await fetchJsonWithBackoff<{ jobs: Array<{ id: number }> }>(
      'https://example.test/api',
    )
    expect(data.jobs[0].id).toBe(1)
  })

  it('throws on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(404, 'not found'))
    await expect(
      fetchJsonWithBackoff('https://example.test/api', { attempts: 1 }),
    ).rejects.toThrow(/HTTP 404/)
  })
})
