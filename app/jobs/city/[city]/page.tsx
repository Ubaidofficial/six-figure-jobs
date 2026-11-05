import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'
import { CITY_TARGETS } from '../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl, SITE_NAME, defaultOgImages } from '../../../../lib/seo/site'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { getCurrencyForCountry } from '../../../../lib/jobs/salaryThresholds'
import { formatCurrencyShort, getThresholdLabelForCountry } from '../../../../lib/seo/salaryLabels'
import { isCityPageIndexable } from '../../../../lib/seo/indexabilityGates'
import { isPhaseIndexable } from '../../../../lib/seo/indexingPhase'
import { isPseoHubUnlocked } from '../../../../lib/seo/pseoUnlock'
import { capDescription } from '../../../../lib/seo/jobMeta'

export const revalidate = 600

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ city: string }>

function resolveCity(slug: string) {
  return CITY_TARGETS.find((c) => c.slug === slug.toLowerCase()) || null
}

function buildBreadcrumbJsonLd(citySlug: string, cityLabel: string, salaryLabel: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: `${salaryLabel} jobs`, item: `${SITE_URL}/jobs/100k-plus` },
      { '@type': 'ListItem', position: 3, name: `${cityLabel} jobs`, item: `${SITE_URL}/jobs/city/${citySlug}` },
    ],
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { city } = await params
  const resolved = resolveCity(city)
  if (!resolved) permanentRedirect('/jobs/100k-plus')

  const { total } = await queryJobs({
    citySlug: resolved.slug,
    countryCode: resolved.countryCode,
    isHundredKLocal: true,
    page: 1,
    pageSize: 1,
  })

  const salaryLabel = getThresholdLabelForCountry(resolved.countryCode ?? null)
  // City pages aren't in the Phase 1 allowlist: noindex until phase 2, unless the hub is clearly substantial.
  const allowIndex =
    isCityPageIndexable(total) &&
    (isPhaseIndexable({
      countryCode: resolved.countryCode ?? null,
      pathname: `/jobs/city/${resolved.slug}`,
    }) ||
      isPseoHubUnlocked(total, `/jobs/city/${resolved.slug}`))
  const titleBase = `${salaryLabel} jobs in ${resolved.label}`
  const title =
    total > 0
      ? `${titleBase} (${total.toLocaleString()} openings) | ${SITE_NAME}`
      : `${titleBase} | ${SITE_NAME}`
  const description = capDescription(
    `${total.toLocaleString()} ${salaryLabel} jobs in ${resolved.label} with salary shown upfront and links to apply. Remote, hybrid and on-site roles, refreshed daily.`,
  )
  const canonical = `${SITE_URL}/jobs/city/${resolved.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { images: defaultOgImages(),
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function CityPage({ params }: { params: Params }) {
  const { city } = await params
  const resolved = resolveCity(city)
  if (!resolved) permanentRedirect('/jobs/100k-plus')

  const { jobs, total, totalPages, page } = await queryJobs({
    citySlug: resolved.slug,
    countryCode: resolved.countryCode,
    isHundredKLocal: true,
    page: 1,
    pageSize: PAGE_SIZE,
  })

  const salaryLabel = getThresholdLabelForCountry(resolved.countryCode ?? null)
  const currencyCode = getCurrencyForCountry(resolved.countryCode ?? null) ?? 'USD'

  const minAnnualValues = jobs
    .map((j) => (j.minAnnual != null ? Number(j.minAnnual) : null))
    .filter((v): v is number => v != null && v > 0)
  const maxAnnualValues = jobs
    .map((j) => (j.maxAnnual != null ? Number(j.maxAnnual) : null))
    .filter((v): v is number => v != null && v > 0)

  const salaryMin =
    minAnnualValues.length > 0 ? Math.min(...minAnnualValues) : 100_000
  const salaryMax =
    maxAnnualValues.length > 0
      ? Math.max(...maxAnnualValues)
      : Math.max(salaryMin, 200_000)
  const salaryMinLabel = formatCurrencyShort(salaryMin, currencyCode)
  const salaryMaxLabel = formatCurrencyShort(salaryMax, currencyCode)

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(resolved.slug, resolved.label, salaryLabel)
  const itemListJsonLd = buildSafeItemListJsonLd({
    name: 'High-paying jobs on Six Figure Jobs',
    jobs: (jobs as JobWithCompany[]).slice(0, PAGE_SIZE),
    page: 1,
    pageSize: PAGE_SIZE,
  })
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How many ${salaryLabel} jobs are in ${resolved.label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${total.toLocaleString()} live roles meet the ${salaryLabel} bar in ${resolved.label}, from company career pages.`,
        },
      },
      {
        '@type': 'Question',
        name: `What is the salary range for ${resolved.label} ${salaryLabel} jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `All listings are ${salaryLabel}; senior roles can exceed top-of-band ranges depending on level, company, and remote eligibility.`,
        },
      },
      {
        '@type': 'Question',
        name: `Do ${resolved.label} jobs include remote options?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Many roles are remote or hybrid; check each listing for eligibility and onsite expectations.',
        },
      },
    ],
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li>{resolved.label}</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-foreground">
        {salaryLabel} jobs in {resolved.label} ({total.toLocaleString()})
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Find <strong className="text-foreground">{total.toLocaleString()}</strong>{' '}
        <strong className="text-foreground">high paying</strong>{' '}
        <strong className="text-primary">{salaryLabel}</strong> jobs in {resolved.label}{' '}
        with verified{' '}
        <strong className="text-primary">six figure salaries</strong>. Browse{' '}
        <strong className="text-primary">{salaryLabel}</strong> roles from{' '}
        {salaryMinLabel} to {salaryMaxLabel} across
        remote, hybrid, and on-site teams.
      </p>
      <p className="mb-6 text-xs text-muted-foreground">
        Showing page {page} of {totalPages}. Only verified compensation and mid-to-senior roles are listed.
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {salaryLabel} roles in {resolved.label} yet. New postings land daily.</p>
      ) : (
        <JobList jobs={jobs as JobWithCompany[]} />
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </main>
  )
}
