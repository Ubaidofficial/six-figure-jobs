// app/jobs/location/[country]/page.tsx
// Programmatic SEO page for country or remote-only high-salary jobs

import type { Metadata } from 'next'
import { TARGET_COUNTRIES } from '../../../../lib/seo/regions'
import { countryCodeToSlug } from '../../../../lib/seo/countrySlug'
import { notFound, redirect } from 'next/navigation'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'
import { queryJobs } from '../../../../lib/jobs/queryJobs'
import { getThresholdLabelForCountry } from '../../../../lib/seo/salaryLabels'

import { CountryLocationTemplate } from '../_components/CountryLocationTemplate'
import { isCountryPageIndexable } from '../../../../lib/seo/indexabilityGates'
import { isPhaseIndexable } from '../../../../lib/seo/indexingPhase'

export const revalidate = 600

const LOCATION_MAP: Record<
  string,
  { label: string; countryCode?: string; remoteOnly?: boolean; slug?: string }
> = {
  remote: { label: 'Remote only', remoteOnly: true, slug: 'remote' as const },
}

for (const c of TARGET_COUNTRIES) {
  const slug = countryCodeToSlug(c.code)
  if (!slug) continue
  LOCATION_MAP[slug] = {
    label: c.label,
    countryCode: c.code,
  }
}

function resolveLocation(slug: string) {
  const key = slug.toLowerCase()
  if (LOCATION_MAP[key]) return { ...LOCATION_MAP[key], slug: key }

  // Legacy code support
  if (key.length === 2) {
    const slugFromCode = countryCodeToSlug(key.toUpperCase())
    if (slugFromCode && LOCATION_MAP[slugFromCode]) {
      return { ...LOCATION_MAP[slugFromCode], slug: slugFromCode, legacy: true }
    }
  }

  return null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>
}): Promise<Metadata> {
  const { country } = await params
  const loc = resolveLocation(country)
  if (!loc) {
    return {
      title: 'Not Found',
      robots: { index: false, follow: false },
    }
  }

  if ((loc as any).legacy) {
    redirect(`/jobs/location/${(loc as any).slug}`)
  }

  const { total } = await queryJobs({
    isHundredKLocal: true,
    countryCode: loc.countryCode ?? undefined,
    remoteMode: loc.remoteOnly ? 'remote' : undefined,
    pageSize: 1,
  })

  const salaryLabel = getThresholdLabelForCountry(loc.countryCode ?? null)

  const title = loc.remoteOnly
    ? `Remote ${salaryLabel} jobs (${total.toLocaleString()}) | ${SITE_NAME}`
    : `${salaryLabel} jobs in ${loc.label} (${total.toLocaleString()}) | ${SITE_NAME}`

  const description = loc.remoteOnly
    ? `Browse ${total.toLocaleString()} remote ${salaryLabel} jobs with published salary ranges, direct apply links, and fresh listings across engineering, product, and data.`
    : `Browse ${total.toLocaleString()} ${salaryLabel} jobs in ${loc.label}. Find high paying ${loc.label} roles, six figure jobs, direct apply links, and verified salary ranges.`

  const canonical = `${getSiteUrl()}/jobs/location/${loc.slug ?? country}`
  // Country listing pages aren't in the Phase 1 allowlist — noindex until phase 2.
  const allowIndex =
    isCountryPageIndexable(total) &&
    isPhaseIndexable({
      countryCode: loc.countryCode ?? null,
      pathname: `/jobs/location/${loc.slug ?? country}`,
    })

  return {
    title,
    description,
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
    },
  }
}

export default async function LocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { country } = await params
  const loc = resolveLocation(country)

  if (!loc) notFound()

  if ((loc as any).legacy) {
    redirect(`/jobs/location/${(loc as any).slug}`)
  }

  if (loc.remoteOnly || !loc.countryCode) {
    notFound()
  }

  const slug = String(loc.slug ?? country).toLowerCase()

  return (
    <CountryLocationTemplate
      loc={{
        slug,
        label: loc.label,
        countryCode: loc.countryCode,
      }}
      searchParams={searchParams}
    />
  )
}
