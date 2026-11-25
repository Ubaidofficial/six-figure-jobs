import { NextResponse } from 'next/server'
import { forgetMemo } from '../../../../lib/cache/memo'

import { getAdminSession } from '../../../../lib/admin/auth'
import { markAdminExpired, unmarkAdminExpired } from '../../../../lib/admin/adminExpired'
import { applyCleanTitle } from '../../../../lib/jobs/applyCleanTitle'
import { expireJobsByIds } from '../../../../lib/jobs/expiry'
import { buildSalaryText } from '../../../../lib/jobs/salary'
import { validateHighSalaryEligibility } from '../../../../lib/normalizers/salary'
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
  const { minAnnual, maxAnnual, salaryMin, salaryMax, ...rest } = job
  const shownPay = buildSalaryText(job as Parameters<typeof buildSalaryText>[0])
  return NextResponse.json(
    {
      // BigInt cannot go into JSON.
      job: {
        ...rest,
        salaryMin: salaryMin?.toString() ?? null,
        salaryMax: salaryMax?.toString() ?? null,
        minAnnual: minAnnual?.toString() ?? null,
        maxAnnual: maxAnnual?.toString() ?? null,
      },
      shownPay,
      hasYearlyRange: minAnnual != null || maxAnnual != null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** Most jobs one bulk action takes (the Review queue shows at most 100 a page). */
const MAX_BULK = 200

export async function PATCH(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ids, ...data } = await req.json()

  // Bulk, from the Review queue: "Expire" or "Pay is right" on the ticked jobs, the same as one at a time.
  if (ids !== undefined) {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK || !ids.every((x) => typeof x === 'string' && x)) {
      return NextResponse.json({ error: `ids must be 1 to ${MAX_BULK} job ids` }, { status: 400 })
    }
    const keys = Object.keys(data).join(',')
    if (keys === 'isExpired' && data.isExpired === true) {
      await expireJobsByIds(ids)
      await markAdminExpired(ids)
    } else if (keys === 'needsReview' && data.needsReview === false) {
      await prisma.job.updateMany({ where: { id: { in: ids } }, data: { needsReview: false } })
    } else {
      return NextResponse.json({ error: 'A bulk action is isExpired: true or needsReview: false' }, { status: 400 })
    }
    forgetMemo('admin:review-counts')
    return NextResponse.json({ ok: true, updated: ids.length })
  }

  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // "Use cleaned title" in the Review queue: the title cleaner's result, written with its dedupe key (as the backfill
  // script does). The page address follows the title; the old one redirects.
  if (data.cleanTitle === true && Object.keys(data).length === 1) {
    const job = await prisma.job.findUnique({ where: { id }, select: { id: true, title: true, companyId: true, locationRaw: true } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    const result = await applyCleanTitle(job)
    if (result.state === 'unchanged') return NextResponse.json({ error: 'The cleaner leaves this title as it is; edit it by hand' }, { status: 400 })
    if (result.state === 'clash') return NextResponse.json({ error: 'Another job of this company already has the cleaned title' }, { status: 409 })
    forgetMemo('admin:review-counts')
    return NextResponse.json({ ok: true, title: result.title })
  }

  // Expiring goes through the same path as the automatic checks, so Google is told the page is gone and the sitemap
  // drops it; restoring clears the expiry dates those checks set, or the freshness rules would still hide the job.
  // Remembered as expired by hand, so the next import that still sees the job does not bring it back.
  if (data.isExpired === true) {
    await expireJobsByIds([id])
    await markAdminExpired(id)
    forgetMemo('admin:review-counts')
    return NextResponse.json({ ok: true })
  }
  if (data.isExpired === false) {
    await prisma.job.update({ where: { id }, data: { isExpired: false, validThrough: null, expiresAt: null } })
    await unmarkAdminExpired(id)
    forgetMemo('admin:review-counts')
    return NextResponse.json({ ok: true })
  }

  // "Pay is right" in the review queue: the import flags pay over $600k a year and does not flag it again once set.
  if (data.needsReview === false && Object.keys(data).length === 1) {
    await prisma.job.update({ where: { id }, data: { needsReview: false } })
    forgetMemo('admin:review-counts')
    return NextResponse.json({ ok: true })
  }

  const allowed = [
    'title', 'company', 'companyLogo', 'locationRaw', 'remoteMode', 'employmentType',
    'salaryMin', 'salaryMax', 'salaryCurrency', 'salaryPeriod',
    // The yearly range is the pay the job page and its JobPosting show; editing it clears the review flag.
    'minAnnual', 'maxAnnual', 'currency', 'needsReview',
    'remote', 'applyUrl', 'descriptionHtml',
    'visaSponsorship', 'postedAt', 'expiresAt',
  ]
  const AMOUNTS = new Set(['salaryMin', 'salaryMax', 'minAnnual', 'maxAnnual'])
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (!(key in data)) continue
    const v = data[key]
    if (AMOUNTS.has(key) && v !== null && !(Number.isSafeInteger(v) && v >= 0)) {
      return NextResponse.json({ error: `${key} must be a whole number` }, { status: 400 })
    }
    update[key] = AMOUNTS.has(key) && v !== null ? BigInt(v) : v
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

  // A new yearly range goes through the import's own pay rules (lib/normalizers/salary.ts), so the job is listed, or not,
  // as if a source had stated that pay: the listings show only jobs whose pay is validated as six figures. The owner's
  // figure is trusted like an ATS's.
  if ('minAnnual' in update || 'maxAnnual' in update || 'currency' in update) {
    const job = await prisma.job.findUnique({ where: { id }, select: { title: true, minAnnual: true, maxAnnual: true, currency: true } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    const minAnnual = ('minAnnual' in update ? update.minAnnual : job.minAnnual) as bigint | null
    const maxAnnual = ('maxAnnual' in update ? update.maxAnnual : job.maxAnnual) as bigint | null
    const currency = ('currency' in update ? update.currency : job.currency) as string | null
    const v = validateHighSalaryEligibility({
      normalized: { minAnnual, maxAnnual, currency, interval: 'year', isHighSalary: false },
      source: 'ats',
      title: (update.title as string | undefined) ?? job.title,
    })
    Object.assign(update, {
      isHighSalary: v.salaryValidated,
      salaryValidated: v.salaryValidated,
      salaryConfidence: v.salaryConfidence,
      salaryParseReason: v.salaryParseReason,
      salaryNormalizedAt: v.salaryNormalizedAt,
      salaryRejectedAt: v.salaryRejectedAt ?? null,
      salaryRejectedReason: v.salaryRejectedReason ?? null,
    })
  }

  await prisma.job.update({ where: { id }, data: update })
  // The review queue's counts in the navigation, so they are right on the next page.
  forgetMemo('admin:review-counts')
  return NextResponse.json({ ok: true })
}
