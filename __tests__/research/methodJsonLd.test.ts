import { buildMethodJsonLd } from '../../lib/research/methodJsonLd'
import { METHOD_CHANGELOG } from '../../lib/research/method'
import { getSiteUrl } from '../../lib/seo/site'

describe('method page JSON-LD', () => {
  // 2026-11-25: Google's URL Inspection reported the method page's rich results as FAIL; its TechArticle had no image
  // and no datePublished, which the report page's passing Article carries.
  it('gives the TechArticle an image and a datePublished on or before dateModified', () => {
    const article = buildMethodJsonLd().find((b) => b['@type'] === 'TechArticle') as Record<string, any>
    expect(article.image).toBe(`${getSiteUrl()}/og-image.png`)
    expect(article.datePublished).toBe(METHOD_CHANGELOG[METHOD_CHANGELOG.length - 1].date)
    expect(article.dateModified).toBe(METHOD_CHANGELOG[0].date)
    expect(article.datePublished <= article.dateModified).toBe(true)
    expect(article).toMatchObject({ headline: expect.any(String), author: { '@type': 'Organization' } })
  })

  it('keeps the breadcrumb on absolute URLs (the configured site URL) ending at the method page', () => {
    const crumbs = buildMethodJsonLd().find((b) => b['@type'] === 'BreadcrumbList') as Record<string, any>
    const items = crumbs.itemListElement.map((i: any) => i.item)
    expect(items.every((u: string) => u.startsWith(getSiteUrl()))).toBe(true)
    expect(items[items.length - 1]).toMatch(/\/high-paying-jobs-report\/method$/)
  })
})
