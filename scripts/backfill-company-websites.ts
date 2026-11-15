// scripts/backfill-company-websites.ts
//
// Fills the website of companies that have none from their live jobs' apply links (rules and reasons in
// lib/companies/websiteFromApplyUrls.ts). A DRY RUN unless --apply. Companies with the most live jobs first. A write only goes in
// while the company still has no website (a value written meanwhile is never replaced).
//
//   npx tsx scripts/backfill-company-websites.ts [--limit=500] [--allow-jobs-evidence] [--apply]
//
// By default a domain must look like the company's name. --allow-jobs-evidence also accepts a domain named by 3+ of its jobs.
//
// SEO: a company's website feeds its job pages' hiringOrganization URL and logo (lib/seo/jobJsonLd.ts) and the company page's
// Organization data, so a wrong one is worse than none: see the evidence rules in the library.
import { appendFileSync } from 'node:fs'

import { employerHostFromApplyUrl, pickCompanyWebsite, registrableDomain } from '../lib/companies/websiteFromApplyUrls'
import { normalizePublicCompanyWebsite } from '../lib/companies/website'
import { parseLimit } from '../lib/ai/freeEnrichWrite'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')
const allowJobsEvidence = process.argv.includes('--allow-jobs-evidence')

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const limit = parseLimit(arg('limit'), 500, 5000)
  const lines: string[] = [`## Company websites from apply links (${apply ? 'APPLY' : 'dry run, nothing written'})`, '']
  const out = (s = '') => lines.push(s)
  try {
    // Measured from our own data: a domain that 3+ different companies' live jobs apply on is a vendor or a board, not an employer;
    // a domain that already is some company's website is not handed to a second company.
    const links = await prisma.job.findMany({ where: { isExpired: false, companyId: { not: null }, applyUrl: { not: null } }, select: { companyId: true, applyUrl: true } })
    const companiesByDomain = new Map<string, Set<string>>()
    for (const l of links) {
      const host = employerHostFromApplyUrl(l.applyUrl)
      if (!host) continue
      const d = registrableDomain(host)
      const set = companiesByDomain.get(d) ?? new Set<string>()
      set.add(l.companyId!)
      companiesByDomain.set(d, set)
    }
    const sharedDomains = new Set([...companiesByDomain].filter(([, set]) => set.size >= 3).map(([d]) => d))
    const takenDomains = new Set<string>()
    for (const c of await prisma.company.findMany({ where: { website: { not: null } }, select: { website: true } })) {
      const site = normalizePublicCompanyWebsite(c.website)
      if (site) takenDomains.add(registrableDomain(new URL(site).hostname.replace(/^www\./, '')))
    }
    const companies = await prisma.company.findMany({
      where: { OR: [{ website: null }, { website: '' }], jobs: { some: { isExpired: false } } },
      select: { id: true, name: true, jobs: { where: { isExpired: false }, select: { applyUrl: true, url: true }, take: 40 } },
      orderBy: { jobCount: 'desc' },
      take: limit,
    })
    const tally = { examined: companies.length, filled: 0, nameMatch: 0, byJobsOnly: 0, 'no-employer-link': 0, 'shared-domain': 0, 'several-domains': 0, 'domain-taken': 0, 'not-enough-evidence': 0 }
    const claimed = new Set<string>() // a domain given to one company in this run is not given to a second
    const samples: string[] = []
    for (const c of companies) {
      const pick = pickCompanyWebsite(c.name, c.jobs.flatMap((j) => [j.applyUrl, j.url]), { sharedDomains, takenDomains: new Set([...takenDomains, ...claimed]), allowJobsEvidence })
      if (!pick.ok) {
        tally[pick.reason]++
        if ((pick.reason === 'several-domains' || pick.reason === 'domain-taken') && samples.length < 80) samples.push(`  (skipped, ${pick.reason}) ${c.name}: ${pick.hosts.slice(0, 4).join(', ')}`)
        continue
      }
      claimed.add(pick.website.replace('https://', ''))
      tally.filled++
      if (pick.nameMatch) tally.nameMatch++
      else tally.byJobsOnly++
      if (samples.length < 80) samples.push(`  ${c.name} -> ${pick.website} (${pick.jobs} job link${pick.jobs === 1 ? '' : 's'}${pick.nameMatch ? ', name matches' : ', no name match: 3+ jobs'})`)
      if (apply) await prisma.company.updateMany({ where: { id: c.id, OR: [{ website: null }, { website: '' }] }, data: { website: pick.website } })
    }
    out(`Examined ${tally.examined} companies with live jobs and no website.`)
    out(`${apply ? 'Filled' : 'Would fill'}: **${tally.filled}** (name matches the domain: ${tally.nameMatch}; domain named by 3+ jobs without a name match: ${tally.byJobsOnly})`)
    out(`Shared vendor/board domains found in our data (3+ companies each): ${sharedDomains.size}`)
    out(`Left empty: no employer link (portals/boards only) ${tally['no-employer-link']}, only shared vendor/board domains ${tally['shared-domain']}, several domains ${tally['several-domains']}, domain already another company's ${tally['domain-taken']}, not enough evidence ${tally['not-enough-evidence']}`)
    out()
    out('Samples:')
    for (const s of samples) out(s)
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
