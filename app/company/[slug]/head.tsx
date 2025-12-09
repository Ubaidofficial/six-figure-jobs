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
    select: { slug: true, jobCount: true, updatedAt: true },
  })

  if (!company) return null

  const canonical = `${SITE_URL}/company/${company.slug}`

  return (
    <>
      <link rel="canonical" href={canonical} />
      {(!company.jobCount || company.jobCount <= 0) && (
        <meta name="robots" content="noindex,follow" />
      )}
    </>
  )
}
