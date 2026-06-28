import { buildSliceMetadata } from '../../lib/seo/meta'
import type { JobSlice } from '../../lib/slices/types'

// CLAUDE.md rule: hreflang (alternates.languages) must NOT be emitted on noindex
// pages — it causes Google Search Console warnings. buildSliceMetadata is the
// only place the app emits hreflang, so guard it here.
const slice = { slug: 'tech-us', filters: { countryCode: 'US' } } as unknown as JobSlice

const robotsIndex = (m: ReturnType<typeof buildSliceMetadata>) =>
  (m.robots as { index?: boolean } | undefined)?.index
const languages = (m: ReturnType<typeof buildSliceMetadata>) =>
  (m.alternates as { languages?: unknown } | undefined)?.languages

describe('hreflang is gated on indexability (buildSliceMetadata)', () => {
  it('emits hreflang on an indexable page with a country', () => {
    const meta = buildSliceMetadata(slice, { page: 1, totalJobs: 50 })
    expect(robotsIndex(meta)).toBe(true)
    expect(languages(meta)).toBeDefined()
  })

  it('does NOT emit hreflang on a thin (noindex) page', () => {
    const meta = buildSliceMetadata(slice, { page: 1, totalJobs: 2 })
    expect(robotsIndex(meta)).toBe(false)
    expect(languages(meta)).toBeUndefined()
  })

  it('does NOT emit hreflang on a deep paginated (noindex) page', () => {
    const meta = buildSliceMetadata(slice, { page: 9, totalJobs: 500 })
    expect(robotsIndex(meta)).toBe(false)
    expect(languages(meta)).toBeUndefined()
  })
})
