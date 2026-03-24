// app/jobs/[...slug]/head.tsx
// Emit prev/next link tags for pagination to reinforce canonical signals.

import type { ReactElement } from 'react'
import { withRuntimeFallback } from '@/lib/runtime/fallback'
import { loadSliceFromParams } from '../../../lib/slices/loadSlice'
import { buildWhere } from '../../../lib/jobs/queryJobs'
import { prisma } from '../../../lib/prisma'
import { buildSliceCanonicalUrl } from '../../../lib/seo/canonical'
import type { PageSearchParams } from '../_components/page'

const PAGE_SIZE = 20

function getPageFromSearchParams(sp: PageSearchParams): number {
  const raw = sp.page
  const v = Array.isArray(raw) ? raw[0] : raw
  const pageNum = Number(v || '1')
  return Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1
}

async function resolveSearchParams(
  input?: Promise<PageSearchParams>
): Promise<PageSearchParams> {
  return (await input) || {}
}

export default async function Head({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>
  searchParams?: Promise<PageSearchParams>
}) {
  const resolvedParams = await params
  const sp = await resolveSearchParams(searchParams)
  const page = getPageFromSearchParams(sp)

  return withRuntimeFallback<ReactElement | null>(
    `jobs.slice.${(resolvedParams.slug || []).join('/') || 'root'}.head`,
    async () => {
      const slice = await loadSliceFromParams(resolvedParams.slug)
      const total = await prisma.job.count({
        where: buildWhere({
          ...slice.filters,
          page: 1,
          pageSize: 1,
        }),
      })
      const totalPages =
        total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null

      const links: ReactElement[] = []

      if (totalPages && page > 1) {
        const href = buildSliceCanonicalUrl(slice.filters, page - 1, slice.slug)
        links.push(<link key="prev" rel="prev" href={href} />)
      }

      if (totalPages && page < totalPages) {
        const href = buildSliceCanonicalUrl(slice.filters, page + 1, slice.slug)
        links.push(<link key="next" rel="next" href={href} />)
      }

      return <>{links}</>
    },
    () => null,
  )
}
