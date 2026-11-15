// scripts/fix-entity-company-names.ts
//
// Company names that still carry an HTML entity ("Quest Defense Systems &#038; Solutions, Inc.", "Johnson &amp; Johnson"), shown literally
// to visitors, from feeds that send names escaped (cleanCompanyName now decodes new ones). A DRY RUN unless --apply. Only companies with
// LIVE jobs are touched (the others are invisible, and their slugs hold the garbage too, so renaming them gains nothing):
//   - a decoded twin exists (same name without the entity): the entity company's live jobs move to the twin (each job guarded by
//     "still on the old company", and a job whose dedupeKey the twin already has is left alone, since the pair is unique);
//   - no twin: the company is renamed to the decoded name. Its slug is NEVER changed (a changed slug would break its URL).
// Also: live jobs whose own `company` text carries an entity get the decoded text (guarded by the exact old value).
//
//   npx tsx scripts/fix-entity-company-names.ts [--apply]
import { appendFileSync } from 'node:fs'

import { decodeNameEntities } from '../lib/normalizers/company'

const apply = process.argv.includes('--apply')
const ENTITY = /&(?:#\d{1,6}|#x[0-9a-f]{1,5}|[a-z]{2,6});/i

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const lines: string[] = [`## Entity company names (${apply ? 'APPLY' : 'dry run, nothing written'})`, '']
  const out = (s = '') => lines.push(s)
  try {
    const candidates = (await prisma.company.findMany({ where: { name: { contains: '&' } }, select: { id: true, name: true, slug: true } })).filter((c) => ENTITY.test(c.name))
    out(`Companies whose name has an HTML entity: ${candidates.length}`)
    let relinked = 0
    let renamed = 0
    let leftAlone = 0
    for (const c of candidates) {
      const live = await prisma.job.count({ where: { companyId: c.id, isExpired: false } })
      if (!live) continue // invisible: leave it
      const decoded = decodeNameEntities(c.name).replace(/\s+/g, ' ').trim()
      const twin = await prisma.company.findFirst({ where: { name: { equals: decoded, mode: 'insensitive' }, id: { not: c.id } }, select: { id: true, slug: true } })
      if (twin) {
        out(`- "${c.name}" (/company/${c.slug}, ${live} live jobs): decoded twin exists (/company/${twin.slug}) -> move the jobs to it`)
        const jobs = await prisma.job.findMany({ where: { companyId: c.id, isExpired: false }, select: { id: true, dedupeKey: true } })
        for (const j of jobs) {
          const clash = await prisma.job.findFirst({ where: { companyId: twin.id, dedupeKey: j.dedupeKey }, select: { id: true } })
          if (clash) {
            leftAlone++
            out(`    job ${j.id}: the twin already has this posting (same dedupeKey), left alone`)
            continue
          }
          if (apply) relinked += (await prisma.job.updateMany({ where: { id: j.id, companyId: c.id }, data: { companyId: twin.id, company: decoded } })).count
          else relinked++
        }
      } else {
        out(`- "${c.name}" (/company/${c.slug}, ${live} live jobs): no twin -> rename to "${decoded}" (slug unchanged)`)
        if (apply) renamed += (await prisma.company.updateMany({ where: { id: c.id, name: c.name }, data: { name: decoded } })).count
        else renamed++
      }
    }
    // Live jobs whose own company text carries an entity.
    const jobs = (await prisma.job.findMany({ where: { isExpired: false, company: { contains: '&' } }, select: { id: true, company: true } })).filter((j) => ENTITY.test(j.company ?? ''))
    let texts = 0
    for (const j of jobs) {
      const decoded = decodeNameEntities(j.company ?? '').replace(/\s+/g, ' ').trim()
      out(`- job ${j.id}: company text "${j.company}" -> "${decoded}"`)
      if (apply) texts += (await prisma.job.updateMany({ where: { id: j.id, company: j.company }, data: { company: decoded } })).count
      else texts++
    }
    out()
    out(`${apply ? 'Done' : 'Would do'}: jobs moved to a twin ${relinked}, companies renamed ${renamed}, job company texts decoded ${texts}, left alone (twin already has the posting) ${leftAlone}.`)
  } finally {
    await prisma.$disconnect()
  }
  const report = lines.join('\n')
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
