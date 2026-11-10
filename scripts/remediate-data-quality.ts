// scripts/remediate-data-quality.ts
// Idempotent self-heal for the invariants checked by audit-data-quality.ts.
// Run after every scrape (before the guard) so naturally-accumulating noise
// (duplicate apply URLs, the occasional aggregator/redirect link, 401k salary
// pollution) is cleaned automatically instead of failing the workflow.
// Applies by default; pass --dry-run to preview.
import { prisma } from '../lib/prisma'
import { cleanApplyUrlForSource, isAggregatorApplyUrl, unwrapRedirectUrl } from '../lib/jobs/applyUrl'
import { processLocation } from '../lib/ingest'
import { normalizeRole } from '../lib/normalizers/role'
import { duplicateJobIdsToExpire } from '../lib/jobs/crossSourceDuplicates'
import { COMPANY_WEBSITE_CORRECTIONS, websiteUpdatesFor } from '../lib/companies/websiteCorrections'

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
    select: { id: true, applyUrl: true, url: true, source: true },
  })
  for (const j of withApply) {
    const cur = j.applyUrl as string
    if (!isAggregatorApplyUrl(cur, j.source) && unwrapRedirectUrl(cur) === cur) continue
    const cleaned = cleanApplyUrlForSource(j.source, cur, j.url)
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

  // 5. Missing labels — role "other" and no country — recomputed with the ingest rules, so jobs imported before those
  //    rules improved get them too (2026-11-08: ~90% of live jobs were "other", many on-site jobs had no country).
  //    Only fills gaps: a job's existing role or country is never changed.
  const unlabeled = await prisma.job.findMany({
    where: { isExpired: false, OR: [{ roleSlug: 'other' }, { countryCode: null }] },
    select: { id: true, title: true, roleSlug: true, countryCode: true, locationRaw: true, remote: true, salaryCurrency: true },
  })
  const byRole = new Map<string, string[]>()
  const byCountry = new Map<string, string[]>()
  for (const j of unlabeled) {
    if (j.roleSlug === 'other') {
      const role = normalizeRole(j.title).roleSlug
      if (role !== 'other') byRole.set(role, [...(byRole.get(role) ?? []), j.id])
    }
    if (!j.countryCode) {
      const country = processLocation({ locationText: j.locationRaw, isRemote: j.remote, salaryCurrency: j.salaryCurrency } as never).countryCode
      if (country) byCountry.set(country, [...(byCountry.get(country) ?? []), j.id])
    }
  }
  const roleFixed = [...byRole.values()].reduce((n, ids) => n + ids.length, 0)
  const countryFixed = [...byCountry.values()].reduce((n, ids) => n + ids.length, 0)
  // Raw SQL so updatedAt is left alone: a relabel is not a sign the job is still open, and run-expiry closes jobs whose
  // updatedAt is over 7 days old (Prisma's updateMany would bump it).
  if (!DRY) {
    for (const [roleSlug, ids] of byRole) {
      await prisma.$executeRaw`UPDATE "Job" SET "roleSlug" = ${roleSlug} WHERE "id" = ANY(${ids}) AND "roleSlug" = 'other'`
    }
    for (const [countryCode, ids] of byCountry) {
      await prisma.$executeRaw`UPDATE "Job" SET "countryCode" = ${countryCode} WHERE "id" = ANY(${ids}) AND "countryCode" IS NULL`
    }
  }
  const topRoles = [...byRole].sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([r, ids]) => `${r} ${ids.length}`).join(', ')
  console.log(`[remediate] role relabeled: ${roleFixed} of ${unlabeled.filter((j) => j.roleSlug === 'other').length} "other" (${topRoles}); country filled: ${countryFixed} of ${unlabeled.filter((j) => !j.countryCode).length} missing`)

  // 6. One opening imported twice (an employer's ATS copy and a job board's re-post, location text differing):
  //    keep the employer copy, else the newest. See lib/jobs/crossSourceDuplicates.ts.
  const liveForDupes = await prisma.job.findMany({
    where: { isExpired: false },
    select: { id: true, companyId: true, title: true, locationRaw: true, city: true, applyUrl: true, url: true, postedAt: true, createdAt: true },
  })
  const crossSourceDupes = duplicateJobIdsToExpire(liveForDupes)
  if (!DRY && crossSourceDupes.length) {
    await prisma.job.updateMany({ where: { id: { in: crossSourceDupes } }, data: { isExpired: true, updatedAt: new Date() } })
  }
  console.log(`[remediate] cross-source duplicates expired: ${crossSourceDupes.length}`)

  // 7. Known wrong company websites (guessed from slugs, or missing), so their logos are looked up on the real domain.
  const toCorrect = await prisma.company.findMany({
    where: { slug: { in: Object.keys(COMPANY_WEBSITE_CORRECTIONS) } },
    select: { id: true, slug: true, website: true, logoUrl: true },
  })
  let websitesFixed = 0
  for (const c of toCorrect) {
    const data = websiteUpdatesFor(COMPANY_WEBSITE_CORRECTIONS[c.slug], c)
    if (!Object.keys(data).length) continue
    websitesFixed++
    if (!DRY) await prisma.company.update({ where: { id: c.id }, data })
  }
  console.log(`[remediate] company websites corrected: ${websitesFixed} of ${toCorrect.length} listed`)

  console.log(`[remediate] apply-url sanitized: ${apptySanitized}, deduped(expired): ${deduped}, 401k-fixed: ${planFixed}, inverted-fixed: ${invertedFixed}${DRY ? '  [DRY RUN]' : ''}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error('[remediate] failed:', e); process.exit(1) })
