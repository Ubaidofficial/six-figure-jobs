// scripts/analyze-query-performance.ts
// Basic DB query timing harness for common pages (run against prod/staging DB).

import { PrismaClient } from '@prisma/client'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere } from '../lib/jobs/queryJobs'

const prisma = new PrismaClient()

function envInt(name: string, def: number) {
  const v = process.env[name]
  if (!v) return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

async function time<T>(name: string, fn: () => Promise<T>) {
  const t0 = Date.now()
  const out = await fn()
  const ms = Date.now() - t0
  // eslint-disable-next-line no-console
  console.log(`${name}: ${ms}ms`)
  return out
}

async function main() {
  const take = envInt('TAKE', 20)
  const repeats = envInt('REPEATS', 3)

  const baseGate = { isExpired: false as const, AND: [buildGlobalExclusionsWhere(), buildHighSalaryEligibilityWhere()] }

  const queries: Array<{ name: string; run: () => Promise<unknown> }> = [
    {
      name: 'homepage_latest',
      run: () =>
        prisma.job.findMany({
          where: { isExpired: false },
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true },
        }),
    },
    {
      name: 'high_salary_latest',
      run: () =>
        prisma.job.findMany({
          where: baseGate,
          orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
          take,
          select: { id: true },
        }),
    },
    {
      name: 'role_page_salary',
      run: () =>
        prisma.job.findMany({
          where: { ...baseGate, roleSlug: 'software-engineer' },
          orderBy: [{ maxAnnual: 'desc' }, { createdAt: 'desc' }],
          take,
          select: { id: true },
        }),
    },
    {
      name: 'country_page_salary',
      run: () =>
        prisma.job.findMany({
          where: { ...baseGate, countryCode: 'US' },
          orderBy: [{ maxAnnual: 'desc' }, { createdAt: 'desc' }],
          take,
          select: { id: true },
        }),
    },
    {
      name: 'city_page_salary',
      run: () =>
        prisma.job.findMany({
          where: { ...baseGate, citySlug: 'san-francisco' },
          orderBy: [{ maxAnnual: 'desc' }, { createdAt: 'desc' }],
          take,
          select: { id: true },
        }),
    },
    {
      name: 'remote_region_salary',
      run: () =>
        prisma.job.findMany({
          where: { ...baseGate, remoteMode: 'remote', remoteRegion: 'north-america' },
          orderBy: [{ maxAnnual: 'desc' }, { createdAt: 'desc' }],
          take,
          select: { id: true },
        }),
    },
    {
      name: 'company_page_latest',
      run: async () => {
        const company = await prisma.company.findFirst({ select: { id: true }, orderBy: { jobCount: 'desc' } })
        if (!company?.id) return []
        return prisma.job.findMany({
          where: { companyId: company.id, isExpired: false },
          orderBy: [{ createdAt: 'desc' }],
          take,
          select: { id: true },
        })
      },
    },
    {
      name: 'ai_enrich_backlog',
      run: () =>
        prisma.job.findMany({
          where: { ...baseGate, aiEnrichedAt: null },
          orderBy: [{ minAnnual: 'desc' }, { createdAt: 'desc' }],
          take,
          select: { id: true },
        }),
    },
  ]

  // Warm up
  await time('warmup', () => prisma.job.findMany({ take: 1, select: { id: true } }))

  for (let r = 1; r <= repeats; r++) {
    // eslint-disable-next-line no-console
    console.log(`\n--- run ${r}/${repeats} ---`)
    for (const q of queries) {
      await time(q.name, q.run)
    }
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

