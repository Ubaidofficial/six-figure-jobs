// app/job/[slug]/head.tsx
import { prisma } from '../../../lib/prisma'
import { getSiteUrl } from '../../../lib/seo/site'
import { parseJobSlugParam, buildJobSlug } from '../../../lib/jobs/jobSlug'
import type { JobWithCompany } from '../../../lib/jobs/queryJobs'

const SITE_URL = getSiteUrl()

export default async function Head({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { jobId, externalId } = parseJobSlugParam(slug)

  const ors: any[] = []
  if (jobId) ors.push({ id: jobId })
  if (externalId) ors.push({ externalId })

  if (ors.length === 0) return null

  const where =
    ors.length === 1
      ? { ...ors[0], isExpired: false }
      : { OR: ors, isExpired: false }

  const job = await prisma.job.findFirst({
    where,
    include: { companyRef: true },
  })

  if (!job) return null

  const canonicalSlug = buildJobSlug(job as JobWithCompany)
  const canonicalUrl = `${SITE_URL}/job/${canonicalSlug}`

  return (
    <>
      <link rel="canonical" href={canonicalUrl} />
    </>
  )
}
