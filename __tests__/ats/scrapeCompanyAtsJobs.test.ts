import { scrapeCompanyAtsJobs } from '../../lib/scrapers/ats'

describe('scrapeCompanyAtsJobs result semantics', () => {
  it('returns success=false for unsupported providers', async () => {
    const res = await scrapeCompanyAtsJobs('unsupported-provider' as any, 'https://example.com')
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toMatch(/unsupported/i)
    }
  })

  it('returns success=false for missing atsUrl', async () => {
    const res = await scrapeCompanyAtsJobs('greenhouse' as any, '' as any)
    expect(res.success).toBe(false)
  })

  it('returns success=false for invalid workday urls', async () => {
    const res = await scrapeCompanyAtsJobs('workday' as any, 'not-a-valid-url')
    expect(res.success).toBe(false)
  })

  it('returns success=false for invalid workable urls', async () => {
    const res = await scrapeCompanyAtsJobs('workable' as any, 'not-a-valid-url')
    expect(res.success).toBe(false)
  })

  it('returns success=false for invalid bamboohr urls', async () => {
    const res = await scrapeCompanyAtsJobs('bamboohr' as any, 'https://example.com')
    expect(res.success).toBe(false)
  })
})
