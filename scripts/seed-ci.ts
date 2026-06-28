// scripts/seed-ci.ts
// Seeds a tiny fixture of fully-indexable jobs + companies so the SEO Gates
// "Strict sitemap validation (local)" step can validate real job pages
// (JobPosting JSON-LD, canonical, robots, indexable-set proof) per-PR — not just
// hub pages. Idempotent: safe to run repeatedly. CI-only (empty DB); never run
// against production.
import { PrismaClient } from '@prisma/client'

import { getShortStableIdForJobId } from '../lib/jobs/jobSlug'

const prisma = new PrismaClient()

// Clean, noise-free description well over the 140-char indexability minimum.
const DESCRIPTION =
  '<p>We are hiring an experienced engineer to design, build, and operate large-scale backend systems. ' +
  'You will own services end to end, mentor teammates, and partner with product to ship reliable features. ' +
  'Strong distributed-systems and API design experience is required.</p>'

const COMPANIES = [
  { name: 'Acme Labs', slug: 'acme-labs', website: 'https://acme.com', countryCode: 'US' },
  { name: 'Globex', slug: 'globex', website: 'https://globex.com', countryCode: 'US' },
]

const JOBS = [
  { id: 'ci-seed:1', title: 'Senior Software Engineer', companySlug: 'acme-labs', remote: false, remoteMode: 'onsite', roleSlug: 'software-engineer', min: 180000, max: 220000 },
  { id: 'ci-seed:2', title: 'Staff Backend Engineer', companySlug: 'acme-labs', remote: false, remoteMode: 'onsite', roleSlug: 'backend-engineer', min: 210000, max: 260000 },
  { id: 'ci-seed:3', title: 'Principal Data Engineer', companySlug: 'globex', remote: true, remoteMode: 'remote', roleSlug: 'data-engineer', min: 200000, max: 250000 },
  { id: 'ci-seed:4', title: 'Engineering Manager, Platform', companySlug: 'globex', remote: false, remoteMode: 'onsite', roleSlug: 'engineering-manager', min: 230000, max: 300000 },
]

async function main() {
  const companyId: Record<string, string> = {}
  for (const c of COMPANIES) {
    const row = await prisma.company.upsert({
      where: { slug: c.slug },
      update: { name: c.name, website: c.website, countryCode: c.countryCode },
      create: { name: c.name, slug: c.slug, website: c.website, countryCode: c.countryCode },
    })
    companyId[c.slug] = row.id
  }

  const now = new Date()
  for (const j of JOBS) {
    const company = COMPANIES.find((c) => c.slug === j.companySlug)!
    const data = {
      title: j.title,
      company: company.name,
      companyId: companyId[j.companySlug],
      source: 'ci-seed',
      countryCode: 'US',
      remote: j.remote,
      remoteMode: j.remoteMode,
      locationRaw: j.remote ? 'Remote, US' : 'New York, US',
      descriptionHtml: DESCRIPTION,
      minAnnual: BigInt(j.min),
      maxAnnual: BigInt(j.max),
      currency: 'USD',
      salaryCurrency: 'USD',
      salaryPeriod: 'year',
      salaryValidated: true,
      salaryConfidence: 95,
      salarySource: 'ats',
      isHighSalary: true,
      isExpired: false,
      roleSlug: j.roleSlug,
      shortId: getShortStableIdForJobId(j.id),
      postedAt: now,
      lastSeenAt: now,
      updatedAt: now,
      type: 'Full-time',
      employmentType: 'full-time',
      applyUrl: `https://jobs.${j.companySlug}.com/${j.id.split(':')[1]}`,
    }
    await prisma.job.upsert({ where: { id: j.id }, update: data, create: { id: j.id, ...data } })
  }

  console.log(`[seed-ci] seeded ${COMPANIES.length} companies and ${JOBS.length} indexable jobs`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[seed-ci] failed:', e)
  process.exit(1)
})
