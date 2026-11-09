import { readAshbySalary, scrapeAshby } from '../../lib/scrapers/ats/ashby'
import { readLeverSalaryRange, scrapeLever } from '../../lib/scrapers/ats/lever'

describe('readAshbySalary', () => {
  const comp = (parts: any[]) => ({ summaryComponents: parts })

  it('takes the Salary component and ignores equity, bonus and commission', () => {
    expect(
      readAshbySalary(
        comp([
          { compensationType: 'EquityCashValue', interval: '1 YEAR', currencyCode: 'USD', minValue: null, maxValue: null },
          { compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 207000, maxValue: 285000 },
          { compensationType: 'Bonus', interval: '1 YEAR', currencyCode: 'USD', minValue: 10000, maxValue: 20000 },
        ]),
      ),
    ).toEqual({ min: 207000, max: 285000, currency: 'USD', interval: 'year' })
  })

  it('maps hourly pay and upper-cases the currency', () => {
    expect(readAshbySalary(comp([{ compensationType: 'Salary', interval: '1 HOUR', currencyCode: 'gbp', minValue: 60, maxValue: 80 }]))).toEqual({
      min: 60,
      max: 80,
      currency: 'GBP',
      interval: 'hour',
    })
  })

  it('uses the one bound it has for both', () => {
    expect(readAshbySalary(comp([{ compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 150000, maxValue: null }]))).toMatchObject({
      min: 150000,
      max: 150000,
    })
  })

  it('returns null when it would have to guess: no salary, unknown interval, or no currency', () => {
    expect(readAshbySalary(undefined)).toBeNull()
    expect(readAshbySalary(comp([]))).toBeNull()
    expect(readAshbySalary(comp([{ compensationType: 'EquityPercentage', interval: 'NONE', currencyCode: null, minValue: 1, maxValue: 2 }]))).toBeNull()
    expect(readAshbySalary(comp([{ compensationType: 'Salary', interval: '2 WEEKS', currencyCode: 'USD', minValue: 1, maxValue: 2 }]))).toBeNull()
    expect(readAshbySalary(comp([{ compensationType: 'Salary', interval: '1 YEAR', minValue: 100000, maxValue: 120000 }]))).toBeNull()
  })
})

describe('scrapeAshby asks for compensation and keeps the structured salary', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('requests includeCompensation=true and maps a job with a salary', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const urls: string[] = []
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      urls.push(url)
      return new Response(
        JSON.stringify({
          jobs: [
            {
              id: 'job-1',
              title: 'Staff Engineer',
              jobUrl: 'https://jobs.ashbyhq.com/acme/job-1',
              location: 'Remote - US',
              descriptionHtml: '<p>Build things.</p>',
              compensation: {
                compensationTierSummary: '$207K – $285K • Offers Equity',
                scrapeableCompensationSalarySummary: '$207K - $285K',
                summaryComponents: [{ compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 207000, maxValue: 285000 }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }) as any

    const jobs = await scrapeAshby('https://jobs.ashbyhq.com/acme')

    expect(urls[0]).toBe('https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true')
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ salaryMin: 207000, salaryMax: 285000, salaryCurrency: 'USD', salaryInterval: 'year' })
    expect(jobs[0].salaryRaw).toContain('$207K')
  })
})

describe('readLeverSalaryRange', () => {
  it('maps a yearly range', () => {
    expect(readLeverSalaryRange({ min: 110000, max: 129000, currency: 'usd', interval: 'per-year-salary' })).toEqual({
      min: 110000,
      max: 129000,
      currency: 'USD',
      interval: 'year',
    })
  })

  it('maps an hourly wage', () => {
    expect(readLeverSalaryRange({ min: 70, max: 90, currency: 'USD', interval: 'per-hour-wage' })).toMatchObject({ interval: 'hour' })
  })

  it('returns null for a bonus, a missing currency, or no numbers', () => {
    expect(readLeverSalaryRange({ min: 5000, max: 5000, currency: 'USD', interval: 'one-time-bonus' })).toBeNull()
    expect(readLeverSalaryRange({ min: 100000, max: 120000, interval: 'per-year-salary' })).toBeNull()
    expect(readLeverSalaryRange({ currency: 'USD', interval: 'per-year-salary' })).toBeNull()
    expect(readLeverSalaryRange(null)).toBeNull()
  })
})

describe('scrapeLever uses the structured salaryRange', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('maps salaryRange onto the job', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    globalThis.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: 'abc',
              text: 'Senior Scientist',
              hostedUrl: 'https://jobs.lever.co/synthego/abc',
              categories: { location: 'Redwood City, CA', commitment: 'Full-time' },
              salaryRange: { min: 110000, max: 129000, currency: 'USD', interval: 'per-year-salary' },
              descriptionPlain: 'Run experiments.',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ) as any

    const jobs = await scrapeLever('https://jobs.lever.co/synthego')
    expect(jobs[0]).toMatchObject({ salaryMin: 110000, salaryMax: 129000, salaryCurrency: 'USD', salaryInterval: 'year' })
  })
})
