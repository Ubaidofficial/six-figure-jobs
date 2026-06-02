import { scrapeAshby } from '../../lib/scrapers/ats/ashby'

describe('scrapeAshby salary extraction', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (
        url.includes('/api/jobs') ||
        url.includes('?format=json') ||
        url.includes('api.ashbyhq.com') ||
        url.includes('posting-api')
      ) {
        return new Response(JSON.stringify({ jobs: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (url.endsWith('/sample/job/job-123')) {
        return new Response(
          '<main><h1>Staff Engineer</h1><div class="job-description">Build the platform for senior users.</div></main>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        )
      }

      return new Response(
        `
          <main>
            <a data-job-id="job-123" href="/sample/job/job-123">
              <h2>Staff Engineer</h2>
              <span data-job-location>United States</span>
              <span data-job-compensation>$150,000 - $190,000 USD</span>
            </a>
          </main>
        `,
        { status: 200, headers: { 'content-type': 'text/html' } },
      )
    }) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('promotes Ashby card compensation into top-level salaryRaw', async () => {
    const jobs = await scrapeAshby('https://jobs.ashbyhq.com/sample')

    expect(jobs).toHaveLength(1)
    expect(jobs[0].salaryRaw).toBe('$150,000 - $190,000 USD')
    expect(jobs[0].raw.salaryRaw).toBe('$150,000 - $190,000 USD')
  })
})
