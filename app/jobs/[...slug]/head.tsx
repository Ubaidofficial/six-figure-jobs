// app/jobs/[...slug]/head.tsx
// Emit prev/next link tags for pagination to reinforce canonical signals.

import type { ReactElement } from 'react'
import { loadSliceFromParams } from '../../../lib/slices/loadSlice'
import { buildSliceCanonicalUrl } from '../../../lib/seo/canonical'
import type { PageSearchParams } from './page'

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
  const slice = await loadSliceFromParams(resolvedParams.slug)
  const sp = await resolveSearchParams(searchParams)
  const page = getPageFromSearchParams(sp)

  const total = slice.jobCount ?? 0
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
}
