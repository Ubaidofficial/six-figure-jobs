import { prisma } from '../lib/prisma'

async function checkSalaries() {
  console.log('\n📊 CHECKING SALARY DATA...\n')

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

  console.log(`✅ Total active jobs: ${totalJobs}`)
  console.log(`💰 Jobs with salary data: ${jobsWithSalary} (${Math.round((jobsWithSalary / totalJobs) * 100)}%)`)
  console.log(`❌ Jobs WITHOUT salary: ${jobsWithoutSalary} (${Math.round((jobsWithoutSalary / totalJobs) * 100)}%)`)

  // Sample 10 jobs with salary
  console.log('\n📋 SAMPLE JOBS WITH SALARY:\n')
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
    console.log(`${job.company}: ${job.title}`)
    console.log(`  💵 ${job.currency || 'USD'} ${min.toLocaleString()} - ${max.toLocaleString()}`)
  })

  // Sample 10 jobs WITHOUT salary
  console.log('\n❌ SAMPLE JOBS WITHOUT SALARY:\n')
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
    console.log(`${job.company}: ${job.title}`)
    console.log(`  Raw salary: ${job.salaryRaw || 'NONE'}`)
    console.log(`  Source: ${job.source || 'unknown'}`)
    console.log(`  URL: ${job.url || 'unknown'}`)
    console.log('')
  })

  console.log('\n✅ DONE\n')
}

checkSalaries()
  .catch(console.error)
  .finally(() => prisma.$disconnect())