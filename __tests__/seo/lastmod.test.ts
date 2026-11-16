import { newestLastmod, sitemapDate } from '../../lib/seo/lastmod'

const NOW = new Date('2026-11-16T12:00:00.000Z')

describe('sitemapDate', () => {
  it('states a day, in UTC', () => {
    expect(sitemapDate(new Date('2026-11-15T23:59:59.999Z'), NOW)).toBe('2026-11-15')
    expect(sitemapDate('2026-11-16T00:00:00.000Z', NOW)).toBe('2026-11-16')
  })

  it('gives nothing, not now, for a missing or invalid date', () => {
    for (const v of [null, undefined, '', 'soon', new Date('nope')]) expect(sitemapDate(v as never, NOW)).toBeNull()
  })

  it('gives nothing for a date in the future', () => {
    expect(sitemapDate(new Date('2026-11-20T00:00:00.000Z'), NOW)).toBeNull()
  })
})

describe('newestLastmod', () => {
  const xml = (...dates: string[]) => `<urlset>${dates.map((d) => `<url><loc>https://x/${d}</loc><lastmod>${d}</lastmod></url>`).join('')}</urlset>`

  it('is the newest day among the entries, whatever mix of days and times they use', () => {
    expect(newestLastmod(xml('2026-05-01', '2026-11-14T14:49:05.981Z', '2026-11-15'), NOW)).toBe('2026-11-15')
  })

  it('is null for a file with no dates, and ignores a future one', () => {
    expect(newestLastmod('<urlset></urlset>')).toBeNull()
    expect(newestLastmod(xml('2026-05-01', '2999-01-01'))).toBe('2026-05-01')
  })
})
