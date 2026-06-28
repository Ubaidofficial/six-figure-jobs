import { isAggregatorApplyUrl, cleanApplyUrl, unwrapRedirectUrl } from '../../lib/jobs/applyUrl'

describe('isAggregatorApplyUrl', () => {
  it('flags aggregator/scraper hosts (incl. subdomains + www)', () => {
    expect(isAggregatorApplyUrl('https://builtin.com/job/123')).toBe(true)
    expect(isAggregatorApplyUrl('https://www.builtin.com/job/123')).toBe(true)
    expect(isAggregatorApplyUrl('https://nodesk.co/remote-jobs/x')).toBe(true)
    expect(isAggregatorApplyUrl('https://remote100k.com/j/x')).toBe(true)
    expect(isAggregatorApplyUrl('https://www.6figjobs.com/job/x')).toBe(true)
  })

  it('treats real employer/ATS hosts as valid apply destinations', () => {
    expect(isAggregatorApplyUrl('https://boards.greenhouse.io/figma/jobs/1')).toBe(false)
    expect(isAggregatorApplyUrl('https://jobs.lever.co/acme/abc')).toBe(false)
    expect(isAggregatorApplyUrl('https://careers.acme.com/role')).toBe(false)
    expect(isAggregatorApplyUrl(null)).toBe(false)
  })
})

describe('cleanApplyUrl', () => {
  it('returns the first non-aggregator http(s) candidate', () => {
    expect(cleanApplyUrl('https://jobs.lever.co/acme/abc', 'https://builtin.com/job/1')).toBe(
      'https://jobs.lever.co/acme/abc',
    )
    // applyUrl aggregator, url is the real ATS → use url
    expect(cleanApplyUrl('https://builtin.com/job/1', 'https://boards.greenhouse.io/x/jobs/2')).toBe(
      'https://boards.greenhouse.io/x/jobs/2',
    )
  })

  it('returns null when every candidate is an aggregator or invalid', () => {
    expect(cleanApplyUrl('https://builtin.com/job/1', 'https://builtin.com/job/1')).toBeNull()
    expect(cleanApplyUrl(null, undefined, 'not-a-url')).toBeNull()
  })

  // Regression: BuiltIn surfaces some jobs as ad.doubleclick.net links that
  // embed the real employer URL. cleanApplyUrl must unwrap, not pass through.
  it('unwraps ad-redirect wrappers to the embedded employer URL', () => {
    expect(
      cleanApplyUrl(
        'https://ad.doubleclick.net/ddm/clk/628601142;435308584;f?https://www.capitalonecareers.com/job/-/-/234/9096540',
      ),
    ).toBe('https://www.capitalonecareers.com/job/-/-/234/9096540')
  })
})

describe('unwrapRedirectUrl', () => {
  it('extracts the destination from a doubleclick /ddm/clk wrapper', () => {
    expect(
      unwrapRedirectUrl('https://ad.doubleclick.net/ddm/clk/1;2;f?https://jobs.example.com/123'),
    ).toBe('https://jobs.example.com/123')
  })

  it('extracts the destination from an ?adurl= / ?url= param redirect', () => {
    expect(
      unwrapRedirectUrl('https://www.googleadservices.com/pagead/aclk?sa=L&adurl=https%3A%2F%2Fcareers.acme.com%2Frole'),
    ).toBe('https://careers.acme.com/role')
  })

  it('leaves a normal ATS URL untouched (incl. legit query params)', () => {
    expect(unwrapRedirectUrl('https://jobs.lever.co/acme/abc?utm_source=x')).toBe(
      'https://jobs.lever.co/acme/abc?utm_source=x',
    )
    expect(unwrapRedirectUrl('https://boards.greenhouse.io/x/jobs/2')).toBe(
      'https://boards.greenhouse.io/x/jobs/2',
    )
  })
})
