// lib/seo/company.ts
import type { Metadata } from 'next'
import type { Company } from '@prisma/client'

const SITE_NAME = 'Remote100k'
const ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://remote100k.com'

export type CompanyMetaContext = {
  page: number
  totalJobs: number
}

function buildCanonical(slug: string, page: number): string {
  const basePath = `/company/${slug}`
  if (page <= 1) return `${ORIGIN}${basePath}`
  return `${ORIGIN}${basePath}?page=${page}`
}

export function buildCompanyMetadata(
  company: Company,
  ctx: CompanyMetaContext
): Metadata {
  const baseTitle = `${company.name} jobs paying $100k+`
  const title =
    ctx.page > 1
      ? `${baseTitle} (Page ${ctx.page}) | ${SITE_NAME}`
      : `${baseTitle} | ${SITE_NAME}`

  // Optional description is not in the Prisma type, so read via `any`
  const rawDescription =
    ((company as any).description as string | null | undefined) ?? null

  const description =
    rawDescription && rawDescription.trim().length > 0
      ? rawDescription.trim()
      : ctx.totalJobs > 0
      ? `Browse ${ctx.totalJobs.toLocaleString()}+ $100k+ jobs at ${company.name} on ${SITE_NAME}.`
      : `Discover $100k+ roles at ${company.name} on ${SITE_NAME}.`

  const canonical = buildCanonical(company.slug, ctx.page)

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
  }
}
