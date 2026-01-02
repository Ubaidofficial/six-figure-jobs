/**
 * QA Salary Coverage Script
 *
 * Run:
 *   npx tsx scripts/qaSalaryCoverage.ts
 */

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

function fmt(n: any) {
  return n == null ? 'null' : Number(n).toLocaleString()
}

async function main() {
  __slog('🔍 QA Salary Coverage Report\n')

  const totalJobs = await prisma.job.count()
  __slog(`Total jobs: ${totalJobs}\n`)

  const missingNormalized = await prisma.job.count({
    where: {
      OR: [
        { minAnnual: null },
        { maxAnnual: null },
      ],
    },
  })

  __slog(`❗ Jobs missing minAnnual/maxAnnual: ${missingNormalized}`)

  const withNormalized = await prisma.job.count({
    where: {
      AND: [
        { minAnnual: { not: null } },
        { maxAnnual: { not: null } },
      ],
    },
  })

  __slog(`✔ Jobs with normalized salary: ${withNormalized}\n`)

  const invalidHighValues = await prisma.job.count({
    where: {
      OR: [
        { minAnnual: { gt: BigInt(1_000_000) } },
        { maxAnnual: { gt: BigInt(1_000_000) } },
      ],
    },
  })

  __slog(`⚠ Suspicious salary values (> $1M/yr): ${invalidHighValues}\n`)

  const highSalary = await prisma.job.count({
    where: { isHighSalary: true },
  })

  const hundredK = await prisma.job.count({
    where: { isHundredKLocal: true },
  })

  __slog(`💰 isHighSalary=true:      ${highSalary}`)
  __slog(`💵 isHundredKLocal=true:  ${hundredK}\n`)

  __slog('📌 Sample jobs missing normalized salary (first 10):')
  const sampleMissing = await prisma.job.findMany({
    where: {
      OR: [
        { minAnnual: null },
        { maxAnnual: null },
      ],
    },
    take: 10,
    select: {
      id: true,
      title: true,
      company: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      salaryPeriod: true,
      minAnnual: true,
      maxAnnual: true,
    },
  })

  sampleMissing.forEach((j) => {
    __slog(
      `- ${j.id} | ${j.title} @ ${j.company}\n` +
      `   raw: ${fmt(j.salaryMin)}–${fmt(j.salaryMax)} ${j.salaryCurrency || ''} (${j.salaryPeriod})\n` +
      `   normalized: ${fmt(j.minAnnual)}–${fmt(j.maxAnnual)}`
    )
  })

  __slog('\n🎉 Done.')
}

main().catch((err) => {
  __serr(err)
  process.exit(1)
})
