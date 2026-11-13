import { COMPANY_SIZE_BUCKETS } from '@/lib/jobs/levelSizeFacets'
import { toSiteSizeBucket } from '@/lib/companies/sizeBucket'

describe('toSiteSizeBucket', () => {
  it('leaves the site\'s own buckets as they are', () => {
    for (const bucket of COMPANY_SIZE_BUCKETS) expect(toSiteSizeBucket(bucket)).toBe(bucket)
  })

  it.each<[string, string]>([
    // freehire's company_size values seen on 2026-11-13
    ['201-500', '201-1000'],
    ['501-1000', '201-1000'],
    ['1000+', '1000+'],
    // what the AI enricher writes for large companies, which the filter would never match
    ['1001-5000', '1000+'],
    ['5000+', '1000+'],
    ['10,000+', '1000+'],
    ['2-10', '1-10'],
    ['10-50', '11-50'],
    ['200+', '201-1000'],
    ['50+', '51-200'],
    ['1,001 - 5,000', '1000+'],
    ['51–200', '51-200'],
    ['200 employees', '51-200'],
    ['1000', '201-1000'],
  ])('"%s" is the %s bucket', (raw, expected) => {
    expect(toSiteSizeBucket(raw)).toBe(expected)
  })

  it('gives null for anything that is not a number or a range', () => {
    for (const raw of ['', '   ', 'startup', 'unknown', 'Series B', '0', '0-0', '500-100', 'N/A', null, undefined, 42, {}]) {
      expect(toSiteSizeBucket(raw)).toBeNull()
    }
  })
})
