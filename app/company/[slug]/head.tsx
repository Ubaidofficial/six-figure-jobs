// app/company/[slug]/head.tsx
// Canonical link for company pages and noindex when no live roles.

import { prisma } from '../../../lib/prisma'
import { getSiteUrl } from '../../../lib/seo/site'

const SITE_URL = getSiteUrl()

export default async function Head({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { slug: true },
  })

  if (!company) return null

  // Count live jobs using the relation (companyRef) instead of companySlug
  const liveJobCount = await prisma.job.count({
    where: {
      isExpired: false,
      companyRef: {
        slug: company.slug,
      },
    },
  })

  const canonical = `${SITE_URL}/company/${company.slug}`

  return (
    <>
      <link rel="canonical" href={canonical} />
      {liveJobCount <= 0 && <meta name="robots" content="noindex,follow" />}
    </>
  )
}
