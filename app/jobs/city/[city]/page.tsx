import type { Metadata } from 'next'
import { keywordsFor } from '@/lib/seo/keywordMap'
import Link from '@/components/ui/Link'
import { permanentRedirect } from 'next/navigation'
import { CITY_TARGETS } from '../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import { loadTopRolePages, topRolesRow } from '../../../../lib/roles/topRolePages'
import JobList from '../../../components/JobList'
import { getSiteUrl, SITE_NAME, defaultOgImages } from '../../../../lib/seo/site'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { getCurrencyForCountry } from '../../../../lib/jobs/salaryThresholds'
import { formatCurrencyShort, getThresholdLabelForCountry } from '../../../../lib/seo/salaryLabels'
import { isCityPageIndexable } from '../../../../lib/seo/indexabilityGates'
import { isPhaseIndexable } from '../../../../lib/seo/indexingPhase'
import { isPseoHubUnlocked } from '../../../../lib/seo/pseoUnlock'
import { buildCityTitle, buildListingDescription } from '../../../../lib/seo/metaText'
import { Faq, JobRows, ListingHeader, ListingLayout, ListingPage, ListingSection } from '@/components/listing/ListingParts'
import { ListingSalaryAside } from '@/components/listing/ListingSalaryAside'
import { RelatedSearches } from '@/components/listing/RelatedSearches'
import { loadRelatedSearches, relatedInput } from '../../../../lib/jobs/relatedSearches'
import { TARGET_COUNTRIES } from '../../../../lib/seo/regions'
import { countryCodeToSlug } from '../../../../lib/seo/countrySlug'

export const revalidate = 600

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ city: string }>

// Without generateStaticParams a dynamic route is rendered on every request and `revalidate` does nothing (measured 2026-11-20:
// 2-6 s to first byte in production, repeated, with no x-nextjs-cache header in a local build). Returning an empty list builds
// nothing at deploy time (the build may not reach the database) but lets each page be cached on its first request and refreshed
// in the background every `revalidate` seconds. Unknown slugs still 404 (dynamicParams stays true).
export async function generateStaticParams(): Promise<Array<Record<string, string>>> {
  return []
}

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
  const title = buildCityTitle(resolved.label, salaryLabel, resolved.countryCode)
  const description = buildListingDescription(
    `High-paying jobs in ${resolved.label} (${salaryLabel}).`,
    [['Remote, hybrid and on-site roles.']], total)
  const canonical = `${SITE_URL}/jobs/city/${resolved.slug}`

  return {
    title,
    description,
    keywords: keywordsFor('city', { city: resolved.label }),
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
  const topRoles = await loadTopRolePages({ citySlug: resolved.slug, countryCode: resolved.countryCode, isHundredKLocal: true })

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

  const relatedCities = CITY_TARGETS.filter((c) => c.slug !== resolved.slug && c.countryCode === resolved.countryCode).slice(0, 10)

  // "Related searches": the country page, the whole jobs hub and other tracked cities (this country's first), each
  // counted with the destination page's own query.
  const otherCities = CITY_TARGETS.filter((c) => c.slug !== resolved.slug && c.countryCode)
  const country = TARGET_COUNTRIES.find((c) => c.code === resolved.countryCode && countryCodeToSlug(c.code))
  const relatedSearches = await loadRelatedSearches([
    { label: 'All $100k+ jobs', href: '/jobs', input: relatedInput.jobsHub() },
    ...(country
      ? [{ label: `Jobs in ${country.label}`, href: `/jobs/location/${countryCodeToSlug(country.code)}`, input: relatedInput.country(country.code) }]
      : []),
    ...[...otherCities.filter((c) => c.countryCode === resolved.countryCode), ...otherCities.filter((c) => c.countryCode !== resolved.countryCode)]
      .slice(0, 8)
      .map((c) => ({ label: `Jobs in ${c.label}`, href: `/jobs/city/${c.slug}`, input: relatedInput.city(c.slug, c.countryCode!) })),
  ])

  return (
    <ListingPage>
      <ListingHeader
        aside={
          <ListingSalaryAside
            input={{ citySlug: resolved.slug, countryCode: resolved.countryCode, isHundredKLocal: true }}
            scope={`roles in ${resolved.label}`}
          />
        }
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Jobs', href: '/jobs/100k-plus' },
          { label: resolved.label },
        ]}
        accent="High-paying"
        title={`jobs in ${resolved.label} (${salaryLabel})`}
        summary={
          <>
            <strong>{total.toLocaleString()}</strong> {total === 1 ? 'role' : 'roles'} in {resolved.label} paying{' '}
            {salaryLabel}, from {salaryMinLabel} to {salaryMaxLabel} on the listings shown, across remote, hybrid and
            on-site teams.
          </>
        }
        cta={total > 0 ? `Browse ${total.toLocaleString()} ${total === 1 ? 'job' : 'jobs'}` : undefined}
        related={topRolesRow(`Top roles in ${resolved.label}`, topRoles)}
        chips={[
          { label: 'All jobs', href: '/jobs/100k-plus' },
          ...relatedCities.map((c) => ({ label: c.label, href: `/jobs/city/${c.slug}` })),
        ]}
      />

      {/* Alerts filter by country, not city: this one is the city's country, and its label names the country. */}
      <ListingLayout alert={{ countryCode: resolved.countryCode ?? undefined }}>
        <JobRows
          jobs={jobs as JobWithCompany[]}
          empty={{
            title: `No ${salaryLabel} roles in ${resolved.label} yet.`,
            body: 'New postings land daily.',
            href: '/jobs/100k-plus',
            hrefLabel: 'Browse all jobs',
          }}
        />
      </ListingLayout>

      <RelatedSearches items={relatedSearches} />

      <ListingSection title="Frequently asked questions">
        <Faq items={faqJsonLd.mainEntity.map((q) => ({ question: q.name, answer: q.acceptedAnswer.text }))} />
      </ListingSection>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </ListingPage>
  )
}
