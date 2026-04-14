// app/company/[slug]/head.tsx
// Canonical link for company pages and noindex when no live roles.

import type { ReactElement } from 'react'
import { withRuntimeFallback } from '@/lib/runtime/fallback'
import { prisma } from '../../../lib/prisma'
import { buildWhere } from '../../../lib/jobs/queryJobs'
import { getSiteUrl } from '../../../lib/seo/site'
import { isCompanyPageIndexable } from '../../../lib/seo/indexabilityGates'

const SITE_URL = getSiteUrl()

export default async function Head({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return withRuntimeFallback<ReactElement | null>(
    `company.${slug}.head`,
    async () => {
      const company = await prisma.company.findUnique({
        where: { slug },
        select: { slug: true },
      })

      if (!company) return null

      const liveJobCount = await prisma.job.count({
        where: buildWhere({ companySlug: company.slug }),
      })

      const canonical = `${SITE_URL}/company/${company.slug}`

      return (
        <>
          <link rel="canonical" href={canonical} />
          {!isCompanyPageIndexable(liveJobCount) && (
            <meta name="robots" content="noindex,follow" />
          )}
        </>
      )
    },
    () => null,
  )
}
