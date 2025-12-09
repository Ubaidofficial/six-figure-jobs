// app/job/[slug]/head.tsx
// Explicit canonical link and noindex on expired jobs.

import { prisma } from '../../../lib/prisma'
import type { ReactElement } from 'react'
import { parseJobSlugParam, buildJobSlug } from '../../../lib/jobs/jobSlug'
import { getSiteUrl } from '../../../lib/seo/site'

const SITE_URL = getSiteUrl()

export default async function Head({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { jobId, externalId } = parseJobSlugParam(slug)

  const where: any = (() => {
    const ors: any[] = []
    if (jobId) ors.push({ id: jobId })
    if (externalId) ors.push({ externalId })
    if (ors.length === 0) return null
    if (ors.length === 1) return { ...ors[0] }
    return { OR: ors }
  })()

  if (!where) return null

  const job = await prisma.job.findFirst({
    where,
    select: { id: true, title: true, company: true, companyRef: true, isExpired: true },
  })

  if (!job) return null

  const canonicalSlug = buildJobSlug(job)
  const canonicalHref = `${SITE_URL}/job/${canonicalSlug}`

  const links: ReactElement[] = [
    <link key="canonical" rel="canonical" href={canonicalHref} />,
  ]

  if (job.isExpired) {
    links.push(
      <meta key="robots" name="robots" content="noindex,follow" />
    )
  }

  return <>{links}</>
}
