import { isPlaceholderLocation, describeJobLocation } from '../../lib/location/jobLocation'
import { buildJobJsonLd } from '../../lib/seo/jobJsonLd'

describe('placeholder location text', () => {
  it('recognises instructions and placeholders, not places', () => {
    for (const t of ['Defer to Job Opening Location', 'defer to job posting location.', 'See job description', 'TBD', 'N/A', 'Location: TBD', 'Not specified']) {
      expect(isPlaceholderLocation(t)).toBe(true)
    }
    for (const t of ['Denver, CO', 'Remote, US', 'Tbilisi', 'Nashville', '']) {
      expect(isPlaceholderLocation(t)).toBe(false)
    }
  })

  // As served on /jobs (2026-11-10): Quicknode, "Senior Software Engineer - Go".
  const job = {
    id: 'ats:test:defer',
    title: 'Senior Software Engineer - Go',
    remote: false,
    remoteMode: 'onsite',
    countryCode: 'US',
    locationRaw: 'Defer to Job Opening Location',
    primaryLocation: 'Defer to Job Opening Location',
    city: null,
  } as any

  it('never shows it on the job page', () => {
    expect(describeJobLocation(job).text).not.toMatch(/defer/i)
  })

  it('never becomes an addressLocality in JobPosting', () => {
    const place = [].concat((buildJobJsonLd(job) as any).jobLocation ?? [])[0] as any
    expect(place.address.addressCountry).toBe('US')
    expect(place.address.addressLocality).toBeUndefined()
  })
})
