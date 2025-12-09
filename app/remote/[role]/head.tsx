// app/remote/[role]/head.tsx
// Canonical + prev/next for remote role slices.

import type { ReactElement } from 'react'
import { getSiteUrl } from '../../../lib/seo/site'
import { queryJobs } from '../../../lib/jobs/queryJobs'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

function parsePage(sp: SearchParams): number {
  const raw = (sp.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

function normalizeStringParam(value?: string | string[]): string | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function buildCanonicalPath(roleSlug: string, page: number, sp: SearchParams) {
  const base = `/remote/${roleSlug}`
  const params = new URLSearchParams()

  const country = normalizeStringParam(sp.country)
  const region = normalizeStringParam(sp.remoteRegion)
  const minParam = normalizeStringParam(sp.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  if (country) params.set('country', country)
  if (region) params.set('remoteRegion', region)
  if (minAnnual && minAnnual !== 100_000) params.set('min', String(minAnnual))
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export default async function Head({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>
  searchParams: Promise<SearchParams> | SearchParams
}) {
  const p = await params
  const sp = await searchParams
  const page = parsePage(sp)

  const country = normalizeStringParam(sp.country)
  const region = normalizeStringParam(sp.remoteRegion)
  const minParam = normalizeStringParam(sp.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  // Count jobs to know if prev/next links are applicable
  const data = await queryJobs({
    roleSlugs: [p.role],
    countryCode: country || undefined,
    remoteRegion: region || undefined,
    minAnnual,
    page: 1,
    pageSize: 1,
  })

  const totalPages =
    data.total > 0
      ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
      : 1

  const canonicalPath = buildCanonicalPath(p.role, page, sp)
  const canonicalHref = `${SITE_URL}${canonicalPath}`

  const links: ReactElement[] = [
    <link key="canonical" rel="canonical" href={canonicalHref} />,
  ]

  if (page > 1) {
    const prevHref = `${SITE_URL}${buildCanonicalPath(p.role, page - 1, sp)}`
    links.push(<link key="prev" rel="prev" href={prevHref} />)
  }

  if (page < totalPages) {
    const nextHref = `${SITE_URL}${buildCanonicalPath(p.role, page + 1, sp)}`
    links.push(<link key="next" rel="next" href={nextHref} />)
  }

  return <>{links}</>
}
