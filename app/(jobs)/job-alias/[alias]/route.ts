import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildJobSlug, parseJobSlugParam } from '@/lib/jobs/jobSlug'
import { getSiteUrl } from '@/lib/seo/site'

export const dynamic = 'force-dynamic'
export const revalidate = 86400

async function findJobByIncomingSlug(slug: string): Promise<JobWithCompany | null> {
  const { jobId, externalId, shortId } = parseJobSlugParam(slug)

  const ors: any[] = []
  if (jobId) ors.push({ id: jobId })
  if (externalId) ors.push({ externalId })
  if (shortId) ors.push({ shortId })

  if (ors.length === 0) return null

  return (await prisma.job.findFirst({
    where: ors.length === 1 ? { ...ors[0], isExpired: false } : { OR: ors, isExpired: false },
    include: { companyRef: true },
  })) as JobWithCompany | null
}

function buildRedirectResponse(request: Request, canonicalSlug: string) {
  const base = getSiteUrl()
  const target = new URL(`/job/${canonicalSlug}`, base)

  const incomingUrl = new URL(request.url)
  incomingUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value)
  })

  return NextResponse.redirect(target, 308)
}

export async function GET(request: Request, ctx: { params: Promise<{ alias: string }> }) {
  const { alias } = await ctx.params

  const job = await findJobByIncomingSlug(alias)
  if (!job) return new NextResponse('Not found', { status: 404 })

  const canonicalSlug = buildJobSlug(job)
  return buildRedirectResponse(request, canonicalSlug)
}

export async function HEAD(request: Request, ctx: { params: Promise<{ alias: string }> }) {
  return GET(request, ctx)
}

