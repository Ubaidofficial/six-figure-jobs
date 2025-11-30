/**
 * QA Salary Coverage Script
 *
 * Run:
 *   npx tsx scripts/qaSalaryCoverage.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function fmt(n: any) {
  return n == null ? 'null' : Number(n).toLocaleString()
}

async function main() {
  console.log('🔍 QA Salary Coverage Report\n')

  const totalJobs = await prisma.job.count()
  console.log(`Total jobs: ${totalJobs}\n`)

  const missingNormalized = await prisma.job.count({
    where: {
      OR: [
        { minAnnual: null },
        { maxAnnual: null },
      ],
    },
  })

  console.log(`❗ Jobs missing minAnnual/maxAnnual: ${missingNormalized}`)

  const withNormalized = await prisma.job.count({
    where: {
      AND: [
        { minAnnual: { not: null } },
        { maxAnnual: { not: null } },
      ],
    },
  })

  console.log(`✔ Jobs with normalized salary: ${withNormalized}\n`)

  const invalidHighValues = await prisma.job.count({
    where: {
      OR: [
        { minAnnual: { gt: BigInt(1_000_000) } },
        { maxAnnual: { gt: BigInt(1_000_000) } },
      ],
    },
  })

  console.log(`⚠ Suspicious salary values (> $1M/yr): ${invalidHighValues}\n`)

  const highSalary = await prisma.job.count({
    where: { isHighSalary: true },
  })

  const hundredK = await prisma.job.count({
    where: { isHundredKLocal: true },
  })

  console.log(`💰 isHighSalary=true:      ${highSalary}`)
  console.log(`💵 isHundredKLocal=true:  ${hundredK}\n`)

  console.log('📌 Sample jobs missing normalized salary (first 10):')
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
    console.log(
      `- ${j.id} | ${j.title} @ ${j.company}\n` +
      `   raw: ${fmt(j.salaryMin)}–${fmt(j.salaryMax)} ${j.salaryCurrency || ''} (${j.salaryPeriod})\n` +
      `   normalized: ${fmt(j.minAnnual)}–${fmt(j.maxAnnual)}`
    )
  })

  console.log('\n🎉 Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
