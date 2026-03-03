import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function checkSalaries() {
  __slog('\n📊 CHECKING SALARY DATA...\n')

  // Total jobs
  const totalJobs = await prisma.job.count({
    where: { isExpired: false }
  })

  // Jobs with salary data
  const jobsWithSalary = await prisma.job.count({
    where: {
      isExpired: false,
      OR: [
        { minAnnual: { not: null } },
        { maxAnnual: { not: null } }
      ]
    }
  })

  // Jobs WITHOUT salary data
  const jobsWithoutSalary = totalJobs - jobsWithSalary

  __slog(`✅ Total active jobs: ${totalJobs}`)
  __slog(`💰 Jobs with salary data: ${jobsWithSalary} (${Math.round((jobsWithSalary / totalJobs) * 100)}%)`)
  __slog(`❌ Jobs WITHOUT salary: ${jobsWithoutSalary} (${Math.round((jobsWithoutSalary / totalJobs) * 100)}%)`)

  // Sample 10 jobs with salary
  __slog('\n📋 SAMPLE JOBS WITH SALARY:\n')
  const withSalary = await prisma.job.findMany({
    where: {
      isExpired: false,
      minAnnual: { not: null }
    },
    select: {
      id: true,
      title: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      company: true,
    },
    take: 10
  })

  withSalary.forEach(job => {
    const min = job.minAnnual ? Number(job.minAnnual) : 0
    const max = job.maxAnnual ? Number(job.maxAnnual) : 0
    __slog(`${job.company}: ${job.title}`)
    __slog(`  💵 ${job.currency || 'USD'} ${min.toLocaleString()} - ${max.toLocaleString()}`)
  })

  // Sample 10 jobs WITHOUT salary
  __slog('\n❌ SAMPLE JOBS WITHOUT SALARY:\n')
  const withoutSalary = await prisma.job.findMany({
    where: {
      isExpired: false,
      minAnnual: null,
      maxAnnual: null
    },
    select: {
      id: true,
      title: true,
      company: true,
      salaryRaw: true,
      source: true,
      url: true,
    },
    take: 10
  })

  withoutSalary.forEach(job => {
    __slog(`${job.company}: ${job.title}`)
    __slog(`  Raw salary: ${job.salaryRaw || 'NONE'}`)
    __slog(`  Source: ${job.source || 'unknown'}`)
    __slog(`  URL: ${job.url || 'unknown'}`)
    __slog('')
  })

  __slog('\n✅ DONE\n')
}

checkSalaries()
  .catch(console.error)
  .finally(() => prisma.$disconnect())