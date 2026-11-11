import { WARM_PATHS, WARM_USER_AGENT, warmPages } from '../../lib/runtime/warmPages'

const ok = () => ({ status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response
const noWait = async () => {}

describe('warmPages (after a deploy)', () => {
  it('requests each page once, one at a time, as itself', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const seen: string[] = []
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      seen.push(url)
      expect((init?.headers as Record<string, string>)['user-agent']).toBe(WARM_USER_AGENT)
      await new Promise((r) => setTimeout(r, 1))
      inFlight--
      return ok()
    })
    const results = await warmPages('http://127.0.0.1:3000', WARM_PATHS, fetchImpl, noWait)
    expect(maxInFlight).toBe(1)
    expect(seen).toEqual(WARM_PATHS.map((p) => `http://127.0.0.1:3000${p}`))
    expect(results.every((r) => r.status === 200)).toBe(true)
  })

  it('retries the first page while the server starts listening, then carries on', async () => {
    let calls = 0
    const fetchImpl = jest.fn(async () => {
      calls++
      if (calls <= 2) throw new Error('ECONNREFUSED')
      return ok()
    })
    const results = await warmPages('http://x', ['/', '/jobs'], fetchImpl, noWait)
    expect(results.map((r) => r.status)).toEqual([200, 200])
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('never throws: a page that fails is reported and skipped', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.endsWith('/jobs')) throw new Error('timeout')
      return ok()
    })
    const results = await warmPages('http://x', ['/', '/jobs', '/remote'], fetchImpl, noWait)
    expect(results.map((r) => r.status)).toEqual([200, null, 200])
  })
})
