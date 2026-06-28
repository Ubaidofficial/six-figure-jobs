// Data-quality guard: asserts invariants over live job data so regressions
// (a bad scraper, a parser change, an aggregator link slipping through) are
// caught on every scrape run instead of in production. Exits non-zero on any
// violation. Run: `npm run audit:data-quality`.
import { prisma } from '../lib/prisma'
import { isAggregatorApplyUrl, unwrapRedirectUrl } from '../lib/jobs/applyUrl'

const RETIREMENT_PLAN_VALUES = new Set([401000, 403000, 457000])

type Check = { name: string; bad: number; sample: string[] }

async function main() {
  const checks: Check[] = []

  // 1. Apply links must point at real employers — no aggregators, no ad-redirects.
  const withApply = await prisma.job.findMany({
    where: { isExpired: false, applyUrl: { not: null } },
    select: { id: true, applyUrl: true },
  })
  const badApply = withApply.filter((j) => {
    const url = j.applyUrl as string
    return isAggregatorApplyUrl(url) || unwrapRedirectUrl(url) !== url
  })
  checks.push({
    name: 'apply_url_aggregator_or_redirect',
    bad: badApply.length,
    sample: badApply.slice(0, 5).map((j) => `${j.id} → ${j.applyUrl}`),
  })

  // 2. No retirement-plan amounts (401k/403b/457b) masquerading as salaries.
  const validated = await prisma.job.findMany({
    where: { isExpired: false, salaryValidated: true },
    select: { id: true, salaryMin: true, salaryMax: true, salaryCurrency: true },
  })
  const planNoise = validated.filter(
    (j) =>
      (j.salaryMin != null && RETIREMENT_PLAN_VALUES.has(Number(j.salaryMin))) ||
      (j.salaryMax != null && RETIREMENT_PLAN_VALUES.has(Number(j.salaryMax))),
  )
  checks.push({
    name: 'salary_retirement_plan_noise',
    bad: planNoise.length,
    sample: planNoise.slice(0, 5).map((j) => `${j.id} → ${j.salaryMin}-${j.salaryMax}`),
  })

  // 3. No inverted ranges (min > max).
  const inverted = validated.filter(
    (j) => j.salaryMin != null && j.salaryMax != null && Number(j.salaryMin) > Number(j.salaryMax),
  )
  checks.push({
    name: 'salary_inverted_range',
    bad: inverted.length,
    sample: inverted.slice(0, 5).map((j) => `${j.id} → ${j.salaryMin}>${j.salaryMax}`),
  })

  // 4. Validated salaries must carry a currency.
  const noCurrency = validated.filter(
    (j) => (j.salaryMin != null || j.salaryMax != null) && !j.salaryCurrency,
  )
  checks.push({
    name: 'salary_validated_without_currency',
    bad: noCurrency.length,
    sample: noCurrency.slice(0, 5).map((j) => j.id),
  })

  // 5. No two active jobs should share the exact same apply URL (true duplicates).
  const byApply = new Map<string, number>()
  for (const j of withApply) {
    const k = (j.applyUrl as string).trim()
    byApply.set(k, (byApply.get(k) ?? 0) + 1)
  }
  const dupUrls = [...byApply.entries()].filter(([, n]) => n > 1)
  checks.push({
    name: 'duplicate_apply_url',
    bad: dupUrls.reduce((sum, [, n]) => sum + (n - 1), 0),
    sample: dupUrls.slice(0, 5).map(([u, n]) => `${n}× ${u}`),
  })

  let failed = 0
  console.log(`\n[data-quality] active jobs scanned: ${withApply.length} (apply), ${validated.length} (validated salary)\n`)
  for (const c of checks) {
    const status = c.bad === 0 ? 'PASS' : 'FAIL'
    if (c.bad > 0) failed++
    console.log(`  [${status}] ${c.name}: ${c.bad}`)
    for (const s of c.sample) console.log(`           - ${s}`)
  }

  await prisma.$disconnect()
  if (failed > 0) {
    console.error(`\n[data-quality] ${failed} invariant(s) violated.`)
    process.exit(1)
  }
  console.log('\n[data-quality] all invariants hold.')
}

main().catch((e) => {
  console.error('[data-quality] fatal:', e)
  process.exit(1)
})
