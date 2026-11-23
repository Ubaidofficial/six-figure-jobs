import { NextResponse } from 'next/server'

import { getAdminSession } from '../../../../lib/admin/auth'
import { expireJobsByIds } from '../../../../lib/jobs/expiry'
import { buildSalaryText } from '../../../../lib/jobs/salary'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

/** One job with everything the edit drawer shows (the list leaves descriptions out). */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      id: true, title: true, company: true, companyLogo: true, source: true,
      locationRaw: true, remoteMode: true, employmentType: true,
      salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true,
      minAnnual: true, maxAnnual: true, currency: true,
      isExpired: true, postedAt: true, expiresAt: true, createdAt: true,
      applyUrl: true, url: true, visaSponsorship: true, descriptionHtml: true,
    },
  })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { minAnnual, maxAnnual, currency, salaryMin, salaryMax, ...rest } = job
  void currency
  const shownPay = buildSalaryText(job as Parameters<typeof buildSalaryText>[0])
  return NextResponse.json(
    {
      // BigInt cannot go into JSON.
      job: { ...rest, salaryMin: salaryMin?.toString() ?? null, salaryMax: salaryMax?.toString() ?? null },
      shownPay,
      hasYearlyRange: minAnnual != null || maxAnnual != null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function PATCH(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Expiring goes through the same path as the automatic checks, so Google is told the page is gone and the sitemap
  // drops it; restoring clears the expiry dates those checks set, or the freshness rules would still hide the job.
  if (data.isExpired === true) {
    await expireJobsByIds([id])
    return NextResponse.json({ ok: true })
  }
  if (data.isExpired === false) {
    await prisma.job.update({ where: { id }, data: { isExpired: false, validThrough: null, expiresAt: null } })
    return NextResponse.json({ ok: true })
  }

  // "Pay is right" in the review queue: the import flags pay over $600k a year and does not flag it again once set.
  if (data.needsReview === false && Object.keys(data).length === 1) {
    await prisma.job.update({ where: { id }, data: { needsReview: false } })
    return NextResponse.json({ ok: true })
  }

  const allowed = [
    'title', 'company', 'companyLogo', 'locationRaw', 'remoteMode', 'employmentType',
    'salaryMin', 'salaryMax', 'salaryCurrency', 'salaryPeriod',
    'remote', 'applyUrl', 'descriptionHtml',
    'visaSponsorship', 'postedAt', 'expiresAt',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in data) update[key] = data[key]
  }

  await prisma.job.update({ where: { id }, data: update })
  return NextResponse.json({ ok: true })
}
