// scripts/remediate-data-quality.ts
// Idempotent self-heal for the invariants checked by audit-data-quality.ts.
// Run after every scrape (before the guard) so naturally-accumulating noise
// (duplicate apply URLs, the occasional aggregator/redirect link, 401k salary
// pollution) is cleaned automatically instead of failing the workflow.
// Applies by default; pass --dry-run to preview.
import { prisma } from '../lib/prisma'
import { cleanApplyUrl, isAggregatorApplyUrl, unwrapRedirectUrl } from '../lib/jobs/applyUrl'

const DRY = process.argv.includes('--dry-run')
const PLAN_VALUES = new Set([401000, 403000, 457000])

async function main() {
  let apptySanitized = 0
  let deduped = 0
  let planFixed = 0
  let invertedFixed = 0

  // 1. Sanitize aggregator / ad-redirect apply URLs (unwrap → real, or clear).
  const withApply = await prisma.job.findMany({
    where: { isExpired: false, applyUrl: { not: null } },
    select: { id: true, applyUrl: true, url: true },
  })
  for (const j of withApply) {
    const cur = j.applyUrl as string
    if (!isAggregatorApplyUrl(cur) && unwrapRedirectUrl(cur) === cur) continue
    const cleaned = cleanApplyUrl(cur, j.url)
    if (cleaned === cur) continue
    apptySanitized++
    if (!DRY) await prisma.job.update({ where: { id: j.id }, data: { applyUrl: cleaned, updatedAt: new Date() } })
  }

  // 2. Dedupe exact-apply-URL rows — keep the most complete, expire the rest.
  const active = await prisma.job.findMany({
    where: { isExpired: false, applyUrl: { not: null } },
    select: { id: true, applyUrl: true, salaryValidated: true, descriptionHtml: true, companyLogo: true, lastSeenAt: true },
  })
  const byUrl = new Map<string, typeof active>()
  for (const j of active) {
    const k = (j.applyUrl as string).trim()
    if (!byUrl.has(k)) byUrl.set(k, [])
    byUrl.get(k)!.push(j)
  }
  const score = (j: any) =>
    (j.salaryValidated ? 4 : 0) + (j.descriptionHtml ? 2 : 0) + (j.companyLogo ? 1 : 0) +
    (j.lastSeenAt ? new Date(j.lastSeenAt).getTime() / 1e13 : 0)
  const expireIds: string[] = []
  for (const [, rows] of byUrl) {
    if (rows.length < 2) continue
    const sorted = [...rows].sort((a, b) => score(b) - score(a))
    expireIds.push(...sorted.slice(1).map((r) => r.id))
  }
  deduped = expireIds.length
  if (!DRY && expireIds.length) {
    await prisma.job.updateMany({ where: { id: { in: expireIds } }, data: { isExpired: true, updatedAt: new Date() } })
  }

  // 3. 401k/403b/457b salary pollution — drop the bogus bound (keep the real one),
  //    or null the salary if both bounds are noise.
  const validated = await prisma.job.findMany({
    where: { isExpired: false, salaryValidated: true },
    select: { id: true, salaryMin: true, salaryMax: true },
  })
  for (const j of validated) {
    const min = j.salaryMin != null ? Number(j.salaryMin) : null
    const max = j.salaryMax != null ? Number(j.salaryMax) : null
    const minNoise = min != null && PLAN_VALUES.has(min)
    const maxNoise = max != null && PLAN_VALUES.has(max)
    if (!minNoise && !maxNoise) continue
    planFixed++
    if (DRY) continue
    if (minNoise && maxNoise) {
      await prisma.job.update({ where: { id: j.id }, data: { salaryMin: null, salaryMax: null, minAnnual: null, maxAnnual: null, isHighSalary: false, salaryValidated: false, salaryRejectedReason: 'retirement_plan_noise', updatedAt: new Date() } })
    } else if (maxNoise) {
      await prisma.job.update({ where: { id: j.id }, data: { salaryMax: null, maxAnnual: null, updatedAt: new Date() } })
    } else {
      await prisma.job.update({ where: { id: j.id }, data: { salaryMin: null, minAnnual: null, updatedAt: new Date() } })
    }
  }

  // 4. Inverted ranges (min > max) — null the salary (untrustworthy).
  const inverted = validated.filter((j) => j.salaryMin != null && j.salaryMax != null && Number(j.salaryMin) > Number(j.salaryMax))
  invertedFixed = inverted.length
  if (!DRY && inverted.length) {
    await prisma.job.updateMany({ where: { id: { in: inverted.map((j) => j.id) } }, data: { salaryValidated: false, salaryRejectedReason: 'inverted_range', updatedAt: new Date() } })
  }

  console.log(`[remediate] apply-url sanitized: ${apptySanitized}, deduped(expired): ${deduped}, 401k-fixed: ${planFixed}, inverted-fixed: ${invertedFixed}${DRY ? '  [DRY RUN]' : ''}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error('[remediate] failed:', e); process.exit(1) })
