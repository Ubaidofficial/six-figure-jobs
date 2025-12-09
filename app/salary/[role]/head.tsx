// app/salary/[role]/head.tsx
// Emit canonical + prev/next for salary role guides.

import type { ReactElement } from 'react'
import type { PageProps } from './page'
import { buildSliceCanonicalUrl } from '../../../lib/seo/canonical'
import { prisma } from '../../../lib/prisma'

const PAGE_SIZE = 50

function parsePage(searchParams?: Record<string, string | string[] | undefined>): number {
  const raw = (searchParams?.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

export default async function Head({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>
  searchParams?: PageProps['searchParams']
}) {
  const { role } = await params
  const sp = (searchParams && (await searchParams)) || {}
  const page = parsePage(sp)
  const bandSlug = typeof (sp as any).band === 'string' ? (sp as any).band : undefined
  const bandMap: Record<string, number> = {
    '100k-plus': 100_000,
    '200k-plus': 200_000,
    '300k-plus': 300_000,
    '400k-plus': 400_000,
  }
  const minAnnual = bandSlug && bandMap[bandSlug] ? bandMap[bandSlug] : 100_000

  // Count live jobs to estimate total pages for prev/next
  const total = await prisma.job.count({
    where: {
      isExpired: false,
      roleSlug: role,
      OR: [
        { maxAnnual: { gte: BigInt(minAnnual) } },
        { minAnnual: { gte: BigInt(minAnnual) } },
        { isHundredKLocal: true },
      ],
    },
  })

  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1

  const filters = {
    roleSlugs: [role],
    minAnnual,
    isHundredKLocal: true,
  } as any

  const links: ReactElement[] = [
    <link
      key="canonical"
      rel="canonical"
      href={buildSliceCanonicalUrl(filters, page)}
    />,
  ]

  if (page > 1) {
    links.push(
      <link
        key="prev"
        rel="prev"
        href={buildSliceCanonicalUrl(filters, page - 1)}
      />
    )
  }

  if (page < totalPages) {
    links.push(
      <link
        key="next"
        rel="next"
        href={buildSliceCanonicalUrl(filters, page + 1)}
      />
    )
  }

  return <>{links}</>
}
