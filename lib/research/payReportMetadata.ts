// lib/research/payReportMetadata.ts
//
// <head> metadata for one edition of the pay report. The permanent page and the latest edition's dated address share one
// canonical (the permanent path), so the same figures are never indexed under two URLs; an older edition canonicalises to itself.
import type { Metadata } from 'next'

import { PAY_REPORT_HEADING, PAY_REPORT_PATH, editionPath, isLatestEdition, payReportDescription, payReportTitle, type PayReportData } from './payReport'
import { keywordsFor } from '../seo/keywordMap'
import { SITE_NAME, defaultOgImages, getSiteUrl } from '../seo/site'

export function payReportMetadata(r: PayReportData): Metadata {
  const url = `${getSiteUrl()}${isLatestEdition(r) ? PAY_REPORT_PATH : editionPath(r)}`
  const description = payReportDescription(r)
  const heading = `${PAY_REPORT_HEADING}: ${r.month}`
  return {
    title: payReportTitle(r),
    description,
    keywords: keywordsFor('payReport'),
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      images: defaultOgImages(),
      title: heading,
      description,
      url,
      siteName: SITE_NAME,
      type: 'article',
      publishedTime: r.publishedAt,
      modifiedTime: r.updatedAt,
    },
    twitter: { card: 'summary_large_image', title: heading, description },
  }
}
