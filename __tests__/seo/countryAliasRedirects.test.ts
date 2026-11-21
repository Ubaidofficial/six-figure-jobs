import { countryCodeToSlug } from '../../lib/seo/countrySlug'

// /jobs/usa, /jobs/uk, /jobs/canada and /jobs/germany used to be pages that issued a temporary 307. They are now permanent
// redirects in next.config.js, answered without rendering a page (production took 10 s for one on 2026-11-20).
const ALIASES: Array<[string, string]> = [
  ['/jobs/usa', 'US'],
  ['/jobs/uk', 'GB'],
  ['/jobs/canada', 'CA'],
  ['/jobs/germany', 'DE'],
]

describe('country alias redirects', () => {
  const config = require('../../next.config.js')

  it.each(ALIASES)('%s is a permanent redirect to the canonical country page', async (source, code) => {
    const redirects = (await config.redirects()) as Array<{ source: string; destination: string; permanent?: boolean }>
    const found = redirects.find((r) => r.source === source)
    expect(found).toBeDefined()
    expect(found?.permanent).toBe(true)
    expect(found?.destination).toBe(`/jobs/location/${countryCodeToSlug(code)}`)
  })
})
