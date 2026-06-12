// scripts/auditApplyAndCompanyData.ts
// READ-ONLY audit for apply-link + company-data hygiene (#9, #10).
// No writes — quantifies scope before any backfill is designed.

import { prisma } from '../lib/prisma'
import { detectAtsFromUrl } from '../lib/normalizers/ats'

const AGGREGATOR_HOSTS = [
  'nodesk.co',
  'remote100k.com',
  'builtin.com',
  'remotive.com',
  'remoteyeah.com',
  '6figjobs.com',
]

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

async function main() {
  const activeWhere = { isExpired: false }
  const activeJobs = await prisma.job.count({ where: activeWhere })

  const sampled = await prisma.job.findMany({
    where: activeWhere,
    select: { id: true, title: true, source: true, applyUrl: true, url: true },
    orderBy: { updatedAt: 'desc' },
    take: 20000,
  })

  let aggregatorApply = 0
  let nullApply = 0
  const aggBySource: Record<string, number> = {}
  const aggSamples: string[] = []

  for (const j of sampled) {
    if (!j.applyUrl) {
      nullApply++
      continue
    }
    const host = hostOf(j.applyUrl)
    if (host && AGGREGATOR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      aggregatorApply++
      aggBySource[j.source || 'unknown'] = (aggBySource[j.source || 'unknown'] || 0) + 1
      if (aggSamples.length < 8) aggSamples.push(`${j.source} :: ${j.applyUrl}`)
    }
  }

  // Company hygiene
  const totalCompanies = await prisma.company.count()
  const noWebsite = await prisma.company.count({ where: { OR: [{ website: null }, { website: '' }] } })
  const noLogo = await prisma.company.count({ where: { OR: [{ logoUrl: null }, { logoUrl: '' }] } })

  const companySample = await prisma.company.findMany({
    where: { website: { not: null } },
    select: { name: true, website: true },
    take: 5000,
  })
  let atsWebsite = 0
  const atsWebsiteSamples: string[] = []
  for (const c of companySample) {
    if (c.website && detectAtsFromUrl(c.website)) {
      atsWebsite++
      if (atsWebsiteSamples.length < 6) atsWebsiteSamples.push(`${c.name} :: ${c.website}`)
    }
  }

  console.log('=== APPLY-LINK AUDIT (#9) — sample of', sampled.length, 'active jobs ===')
  console.log('active jobs (total):', activeJobs)
  console.log('apply URL points at an AGGREGATOR:', aggregatorApply)
  console.log('  by source:', JSON.stringify(aggBySource))
  console.log('  samples:')
  aggSamples.forEach((s) => console.log('   -', s))
  console.log('apply URL is NULL:', nullApply)
  console.log('')
  console.log('=== COMPANY DATA AUDIT (#10) ===')
  console.log('companies (total):', totalCompanies)
  console.log('no website:', noWebsite, `(${((noWebsite / totalCompanies) * 100).toFixed(1)}%)`)
  console.log('no logoUrl:', noLogo, `(${((noLogo / totalCompanies) * 100).toFixed(1)}%)`)
  console.log('website is an ATS host (sample of', companySample.length, '):', atsWebsite)
  atsWebsiteSamples.forEach((s) => console.log('   -', s))

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
