// app/remote/[role]/[city]/head.tsx
// Canonical + prev/next for remote city role slices.

import { prisma } from '../../../../lib/prisma'
import { getSiteUrl } from '../../../../lib/seo/site'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

function parsePage(searchParams?: SearchParams): number {
  const raw = (searchParams?.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

function normalizeStringParam(
  value?: string | string[]
): string | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function buildCanonicalPath(
  roleSlug: string,
  cityParam: string,
  sp: SearchParams | undefined
) {
  const base = `/remote/${roleSlug}/${cityParam}`
  const params = new URLSearchParams()

  const minParam = normalizeStringParam(sp?.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : null
  if (minAnnual) params.set('min', String(minAnnual))

  const page = parsePage(sp)
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export default async function Head({
  params,
  searchParams,
}: {
  params: Promise<{ role: string; city: string }>
  searchParams?: Promise<SearchParams> | SearchParams
}) {
  const { role, city } = await params
  const sp = searchParams ? await searchParams : {}
  const page = parsePage(sp)

  const minParam = normalizeStringParam(sp?.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  const total = await prisma.job.count({
    where: {
      isExpired: false,
      roleSlug: role,
      citySlug: city,
      OR: [
        { maxAnnual: { gte: BigInt(minAnnual) } },
        { minAnnual: { gte: BigInt(minAnnual) } },
        { isHundredKLocal: true },
      ],
      OR: [{ remote: true }, { remoteMode: 'remote' }],
    },
  })

  const totalPages =
    total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1

  const canonicalPath = buildCanonicalPath(role, city, sp)
  const canonicalHref = `${SITE_URL}${canonicalPath}`

  const links: JSX.Element[] = [
    <link key="canonical" rel="canonical" href={canonicalHref} />,
  ]

  if (page > 1) {
    const prevHref = `${SITE_URL}${buildCanonicalPath(role, city, {
      ...sp,
      page: String(page - 1),
    })}`
    links.push(<link key="prev" rel="prev" href={prevHref} />)
  }

  if (page < totalPages) {
    const nextHref = `${SITE_URL}${buildCanonicalPath(role, city, {
      ...sp,
      page: String(page + 1),
    })}`
    links.push(<link key="next" rel="next" href={nextHref} />)
  }

  return <>{links}</>
}
