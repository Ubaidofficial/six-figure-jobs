/**
 * @jest-environment node
 */
// The 2026-11-10 daily sync crashed in "Sync direct employers" with `AssertionError: assert(!this.paused)` inside
// node_modules/undici. Importing cheerio's main entry loads undici 7, which installs its own Agent as the process-wide
// fetch dispatcher (Symbol.for('undici.globalDispatcher.1')), so Node's built-in fetch ran on a different undici
// version; a Workday 429 retry then crashed the whole process. The scrapers import 'cheerio/slim', which does not
// load undici. This guards against a plain 'cheerio' import coming back.
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('../../lib/prisma', () => ({ prisma: {} }))

const DISPATCHER = Symbol.for('undici.globalDispatcher.1')

describe('scrapers leave fetch on Node’s own dispatcher', () => {
  it('installs no global undici dispatcher when the scrapers and the employer sync chain load', async () => {
    expect((globalThis as Record<symbol, unknown>)[DISPATCHER]).toBeUndefined()
    await import('../../lib/scrapers/ats')
    await import('../../lib/scrapers/ats/ashby')
    await import('../../lib/scrapers/ats/workday')
    await import('../../lib/scrapers/himalayas')
    await import('../../lib/scrapers/builtin')
    await import('../../lib/scrapers/weworkremotely')
    await import('../../lib/scrapers/utils/fetchJobPageDetails')
    await import('../../lib/scrapers/utils/extractApplyLink')
    await import('../../lib/scrapers/utils/companyCareersDiscovery')
    await import('../../lib/jobs/ingestFromAts')
    expect((globalThis as Record<symbol, unknown>)[DISPATCHER]).toBeUndefined()
  })
})
