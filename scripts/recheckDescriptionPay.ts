// scripts/recheckDescriptionPay.ts
//
// Re-checks live jobs whose pay was read from the posting's own sentence (lib/jobs/payEvidence.ts; the sentence is stored as
// salaryRaw) against the reader's current rules. Written on 2026-11-19, when the reader learned that a figure which
// INCLUDES bonus, incentive, variable or commission pay is not a base salary (owner's rule, CLAUDE.md): jobs read before
// that ("Annual Salary Range Including Bonuses: ...", "... which may include potential sales incentive payments") keep the
// wrong figure until something removes them, and freehire's closed-job check keeps refreshing open jobs, so they would not
// expire on their own.
//
//  - a job whose stored sentence says the figure includes bonus/incentive pay has no base salary we can show: listed, and
//    expired with --apply (lib/jobs/expiry.ts, the same path as freehire's closed jobs);
//  - a job the reader now reads in another currency ("$129,000 - $238,000 USD" stored as CAD) is listed only; the next
//    sync that reads it again stores the right one.
// Only sentences the new rule matches are expired: older short pay texts ("$150k - $200k") that the reader would not read
// today are left alone.
//
// A dry run unless --apply is passed.
//   npx tsx scripts/recheckDescriptionPay.ts [--limit=30000] [--apply]
import { format as __format } from 'node:util'

import { expireJobsByIds } from '../lib/jobs/expiry'
import { includesExtraPay, readPayFromDescription } from '../lib/jobs/payEvidence'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')
const limit = Number(arg('limit') ?? 0) || Infinity
const BATCH = 1000

async function main() {
  const counts = { looked: 0, includesExtraPay: 0, otherCurrency: 0, expired: 0 }
  const toExpire: string[] = []
  let cursor: string | undefined
  while (counts.looked < limit) {
    const jobs = await prisma.job.findMany({
      where: { isExpired: false, source: 'board:freehire', salaryRaw: { not: null } },
      select: { id: true, title: true, company: true, salaryRaw: true, salaryCurrency: true, countryCode: true, locationRaw: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (jobs.length === 0) break
    cursor = jobs[jobs.length - 1].id
    for (const job of jobs) {
      if (counts.looked >= limit) break
      counts.looked++
      const sentence = job.salaryRaw ?? ''
      if (includesExtraPay(sentence)) {
        counts.includesExtraPay++
        toExpire.push(job.id)
        __slog(`includes bonus/incentive | ${job.title} — ${job.company} | "${sentence.slice(0, 200)}"`)
        continue
      }
      const now = readPayFromDescription(sentence, { countries: job.countryCode ? [job.countryCode.toLowerCase()] : null, location: job.locationRaw })
      if (now && job.salaryCurrency && now.currency !== job.salaryCurrency) {
        counts.otherCurrency++
        __slog(`stored ${job.salaryCurrency}, reads ${now.currency} | ${job.title} — ${job.company} | "${sentence.slice(0, 200)}"`)
      }
    }
  }
  if (apply && toExpire.length) counts.expired = (await expireJobsByIds(toExpire)).expired
  __slog(`\nlooked at ${counts.looked} | includes bonus/incentive: ${counts.includesExtraPay}${apply ? ` (expired ${counts.expired})` : ' (dry run: nothing expired)'} | other currency now (listed only): ${counts.otherCurrency}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
