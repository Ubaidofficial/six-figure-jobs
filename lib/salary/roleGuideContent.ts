// lib/salary/roleGuideContent.ts
//
// The words on /salary/[role], built only from the numbers in a RoleSalaryGuide: nothing here states a figure the data
// does not support. One place for the takeaways, the FAQ (shown on the page AND emitted as FAQPage JSON-LD, so the two
// always match) and the page's structured data. Pure, so it can be tested without a database.

import type { RoleSalaryGuide } from './roleGuide'

export const MIN_LISTINGS_FOR_FIGURES = 20 // keep in step with MIN_LISTINGS in lib/jobs/salarySnapshot.ts

/** Rounded to the nearest 1,000: a median of 162,437 reads as $162,000, not a precision the data does not have. */
const roundPay = (n: number) => Math.round(n / 1000) * 1000

export function formatPay(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(roundPay(amount))
  } catch {
    return `${currency} ${roundPay(amount).toLocaleString('en-US')}`
  }
}

/** "November 6, 2026" (UTC, so the server's time zone does not move the date). */
export function formatGuideDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

const LEVEL_LABEL: Record<string, string> = { entry: 'Entry-level', mid: 'Mid-level', senior: 'Senior', lead: 'Lead', executive: 'Executive' }
export const levelLabel = (level: string) => LEVEL_LABEL[level] ?? level

type Args = { roleName: string; bandLabel: string; guide: RoleSalaryGuide }

function joinNames(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

const caveat = ({ roleName, bandLabel }: Args) =>
  `These figures cover only listings that publish a salary of ${bandLabel} or more, so they sit above pay for ${roleName} roles overall.`

/** 3 to 5 self-contained bullets. */
export function buildTakeaways(args: Args): string[] {
  const { roleName, bandLabel, guide } = args
  const u = guide.usd
  if (!u) {
    const have =
      guide.listings === 0
        ? `We have no live ${bandLabel} ${roleName} listings right now.`
        : `We track ${guide.listings.toLocaleString('en-US')} live ${bandLabel} ${roleName} listings, ${guide.usdCount.toLocaleString('en-US')} of them in USD.`
    return [
      `${have} A median needs at least ${MIN_LISTINGS_FOR_FIGURES} USD listings, so this page shows no salary figures yet.`,
      caveat(args),
      `New listings are added from company career pages every day, and the figures appear here as soon as the sample is large enough.`,
    ]
  }

  const out = [
    `The median advertised ${roleName} salary in our ${bandLabel} listings is ${formatPay(u.median)} a year (USD, ${u.count.toLocaleString('en-US')} live listings).`,
    `The middle half of those listings pays ${formatPay(u.p25)} to ${formatPay(u.p75)}; individual listings range from ${formatPay(u.lowest)} to ${formatPay(u.highest)}.`,
  ]

  if (guide.levels && guide.levels.length >= 2) {
    const sorted = [...guide.levels].sort((a, b) => b.median - a.median)
    const top = sorted[0]
    const bottom = sorted[sorted.length - 1]
    out.push(
      `${levelLabel(top.level)} ${roleName} roles have the highest median at ${formatPay(top.median)} (${top.count} listings), against ${formatPay(bottom.median)} for ${levelLabel(bottom.level).toLowerCase()} roles (${bottom.count} listings).`,
    )
  }

  if (guide.companies.length >= 2) {
    const top = guide.companies.slice(0, 3)
    out.push(`${joinNames(top.map((c) => `${c.name} (${c.count})`))} have the most open ${bandLabel} ${roleName} listings.`)
  }

  out.push(caveat(args))
  return out
}

export type Faq = { question: string; answer: string }

export function buildFaqs(args: Args): Faq[] {
  const { roleName, bandLabel, guide } = args
  const u = guide.usd
  const asOf = guide.asOf ? ` The data was last refreshed on ${formatGuideDate(guide.asOf)}.` : ''
  const faqs: Faq[] = []

  if (u) {
    faqs.push({
      question: `How much does a ${roleName} make?`,
      answer: `The median ${roleName} salary in our ${bandLabel} listings is ${formatPay(u.median)} a year, based on ${u.count.toLocaleString('en-US')} live USD listings. The middle half of listings pays ${formatPay(u.p25)} to ${formatPay(u.p75)}. ${caveat(args)}`,
    })
    faqs.push({
      question: `What is the salary range for a ${roleName}?`,
      answer: `Individual ${bandLabel} ${roleName} listings range from ${formatPay(u.lowest)} to ${formatPay(u.highest)} a year. The 25th percentile of listing midpoints is ${formatPay(u.p25)} and the 75th percentile is ${formatPay(u.p75)}.`,
    })
  } else {
    faqs.push({
      question: `How much does a ${roleName} make?`,
      answer: `We do not publish a ${roleName} median yet: it needs at least ${MIN_LISTINGS_FOR_FIGURES} live USD listings and we currently have ${guide.usdCount.toLocaleString('en-US')}. This page covers only listings paying ${bandLabel} or more.`,
    })
  }

  if (guide.levels && guide.levels.length >= 2) {
    faqs.push({
      question: `How does ${roleName} pay change with experience level?`,
      answer: `Median pay by level in our ${bandLabel} listings: ${guide.levels.map((l) => `${levelLabel(l.level).toLowerCase()} ${formatPay(l.median)} (${l.count} listings)`).join(', ')}. Levels with fewer than 5 listings are left out.`,
    })
  }

  if (guide.companies.length > 0) {
    faqs.push({
      question: `Which companies are hiring for ${roleName} roles at ${bandLabel}?`,
      answer: `The companies with the most open ${bandLabel} ${roleName} listings are ${joinNames(guide.companies.slice(0, 5).map((c) => `${c.name} (${c.count} listings, median ${formatPay(c.median)})`))}.`,
    })
  }

  faqs.push({
    question: `Where does this ${roleName} salary data come from?`,
    answer: `The figures come from the salary ranges employers publish in their own job listings, collected from company career pages and applicant-tracking systems. Each listing counts once, at the midpoint of its range. Only USD listings go into the headline figures, and listings that are closed or stale are removed.${asOf}`,
  })

  faqs.push({
    question: `Are remote and hybrid ${roleName} jobs included?`,
    answer: `Yes. Each listing is tagged remote, hybrid or on-site, and remote roles carry a region (US only, EMEA, APAC or global), so you can filter the live job list to the arrangement you want.`,
  })

  return faqs
}

export function buildMetaDescription({ roleName, bandLabel, guide }: Args): string {
  const u = guide.usd
  if (!u) return `${roleName} salary guide: pay ranges from live ${bandLabel} job listings, updated daily. Real salary ranges from employers' own postings, no surveys.`
  const when = guide.asOf ? ` Updated ${guide.asOf.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}.` : ''
  return `${roleName} salary: median ${formatPay(u.median)} a year, middle half ${formatPay(u.p25)} to ${formatPay(u.p75)}, from ${u.count.toLocaleString('en-US')} live ${bandLabel} listings.${when}`
}

export type GuideJsonLdArgs = Args & {
  siteUrl: string
  roleSlug: string
  onetCode?: string
  faqs: Faq[]
  /** Fallback for dateModified when the sample is empty. */
  now?: Date
}

/** The page's structured data, as a list of schema.org objects (each emitted as its own JSON-LD script). */
export function buildGuideJsonLd(a: GuideJsonLdArgs): Array<Record<string, unknown>> {
  const { siteUrl, roleSlug, roleName, bandLabel, guide, onetCode, faqs } = a
  const url = `${siteUrl}/salary/${roleSlug}`
  const modified = (guide.asOf ?? a.now ?? new Date()).toISOString()
  const u = guide.usd

  const out: Array<Record<string, unknown>> = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${siteUrl}/jobs/100k-plus` },
        { '@type': 'ListItem', position: 3, name: `${roleName} salary`, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': url,
      url,
      name: `${roleName} salary guide`,
      dateModified: modified,
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['main h1', '[data-speakable="summary"]'] },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Occupation',
      name: roleName,
      description: `${bandLabel} ${roleName} salary data from live job listings.`,
      ...(onetCode ? { occupationalCategory: onetCode } : {}),
      ...(u
        ? {
            estimatedSalary: {
              '@type': 'MonetaryAmountDistribution',
              name: `${roleName} base salary, ${bandLabel} listings`,
              currency: 'USD',
              duration: 'P1Y',
              percentile25: roundPay(u.p25),
              median: roundPay(u.median),
              percentile75: roundPay(u.p75),
            },
          }
        : {}),
    },
  ]

  // Kept from the previous page: an AggregateOffer over the same USD listings (low and high are the lowest and highest
  // listed pay, not percentiles).
  if (u) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: roundPay(u.lowest),
      highPrice: roundPay(u.highest),
      offerCount: u.count,
      url,
      itemOffered: { '@type': 'Occupation', name: roleName, ...(onetCode ? { occupationalCategory: onetCode } : {}) },
    })
  }
  return out
}
