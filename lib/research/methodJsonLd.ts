// lib/research/methodJsonLd.ts
//
// Structured data for the pay report's method page (app/high-paying-jobs-report/method/page.tsx).
import { METHOD_CHANGELOG, METHOD_PATH, METHOD_VERSION } from './method'
import { PAY_REPORT_HEADING, PAY_REPORT_PATH } from './payReport'
import { SITE_NAME, defaultOgImages, getSiteUrl } from '../seo/site'

export const METHOD_DESCRIPTION =
  'How the Six-Figure Job Pay Report is built: what counts, the salary checks, sample floors, what is left out, a data dictionary and the history of method changes.'

/**
 * TechArticle and BreadcrumbList. `image` (the page's own share image) and `datePublished` (the method's first version,
 * the oldest METHOD_CHANGELOG entry) were missing until 2026-11-25: Google's URL Inspection reported the page's rich
 * results as FAIL while the report page's Article, which carries both, passed.
 */
export function buildMethodJsonLd() {
  const siteUrl = getSiteUrl()
  const url = `${siteUrl}${METHOD_PATH}`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      mainEntityOfPage: url,
      headline: `${PAY_REPORT_HEADING}: method and data dictionary (version ${METHOD_VERSION})`,
      description: METHOD_DESCRIPTION,
      url,
      image: defaultOgImages()[0].url,
      datePublished: METHOD_CHANGELOG[METHOD_CHANGELOG.length - 1].date,
      dateModified: METHOD_CHANGELOG[0].date,
      inLanguage: 'en',
      author: { '@type': 'Organization', name: SITE_NAME, url: siteUrl },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: siteUrl, logo: { '@type': 'ImageObject', url: `${siteUrl}/logo.png` } },
      // The Dataset itself is marked up on the report page; a nested Dataset here counts as a second, incomplete one.
      about: { '@type': 'Report', name: PAY_REPORT_HEADING, url: `${siteUrl}${PAY_REPORT_PATH}` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: PAY_REPORT_HEADING, item: `${siteUrl}${PAY_REPORT_PATH}` },
        { '@type': 'ListItem', position: 3, name: 'Method and data dictionary', item: url },
      ],
    },
  ]
}
