// scripts/_danger/cleanup-bad-companies.ts
// Run: npx tsx scripts/_danger/cleanup-bad-companies.ts

import { PrismaClient } from '@prisma/client'

if (process.env.ALLOW_DANGER !== 'true') {
  console.error('Refusing to run. Set ALLOW_DANGER=true to proceed.')
  process.exit(1)
}


const prisma = new PrismaClient()

// Patterns that indicate a "company" is actually a job title
const JOB_TITLE_PATTERNS = [
  /^(senior|junior|lead|principal|staff|director|manager|head|vp|chief)/i,
  /engineer$/i,
  /developer$/i,
  /analyst$/i,
  /specialist$/i,
  /coordinator$/i,
  /consultant$/i,
  /architect$/i,
  /administrator$/i,
  /executive$/i,
  /representative$/i,
  /associate$/i,
  /intern$/i,
  /manager$/i,
  /director$/i,
  /officer$/i,
  /planner$/i,
  /underwriter$/i,
  /^(sr\.|jr\.|sr |jr )/i,
  /\s(I|II|III|IV|V)$/,
  /\s-\s/,
  /\(.*\)$/,
]

const JOB_TITLE_KEYWORDS = [
  'account executive',
  'software engineer',
  'product manager',
  'data scientist',
  'machine learning',
  'full stack',
  'frontend',
  'backend',
  'devops',
  'quality assurance',
  'business development',
  'customer success',
  'sales development',
  'technical writer',
  'ux designer',
  'ui designer',
  'marketing manager',
  'operations manager',
  'project manager',
  'program manager',
  'data analyst',
  'business analyst',
  'financial analyst',
  'recruiter',
  'talent acquisition',
  'human resources',
  'accounts receivable',
  'vice president',
  'head of',
  'director of',
  'manager of',
]

function isLikelyJobTitle(name: string): boolean {
  const lower = name.toLowerCase()
  
  for (const keyword of JOB_TITLE_KEYWORDS) {
    if (lower.includes(keyword)) return true
  }
  
  for (const pattern of JOB_TITLE_PATTERNS) {
    if (pattern.test(name)) return true
  }
  
  if (name.length > 60) return true
  
  return false
}

async function main() {
  process.stdout.write('🔍 Finding companies that are actually job titles...\n\n')

  const allCompanies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { jobs: true } }
    }
  })

  process.stdout.write(`Total companies in DB: ${allCompanies.length}\n`)

  const badCompanies: typeof allCompanies = []
  
  for (const company of allCompanies) {
    if (company.name && isLikelyJobTitle(company.name)) {
      badCompanies.push(company)
    }
  }

  process.stdout.write(`Found ${badCompanies.length} companies that look like job titles\n\n`)
  
  const withJobs = badCompanies.filter(c => c._count.jobs > 0)
  const withoutJobs = badCompanies.filter(c => c._count.jobs === 0)

  process.stdout.write(`📊 ${withJobs.length} have jobs linked\n`)
  process.stdout.write(`🗑️  ${withoutJobs.length} have no jobs (safe to delete)\n\n`)

  process.stdout.write('Examples of bad company names:\n')
  badCompanies.slice(0, 15).forEach(c => {
    process.stdout.write(`  - "${c.name}" (${c._count.jobs} jobs)\n`)
  })

  if (badCompanies.length > 15) {
    process.stdout.write(`  ... and ${badCompanies.length - 15} more\n`)
  }

  // Delete companies with no jobs
  if (withoutJobs.length > 0) {
    process.stdout.write(`\n🗑️  Deleting ${withoutJobs.length} orphaned bad companies...\n`)
    
    const deleteResult = await prisma.company.deleteMany({
      where: { id: { in: withoutJobs.map(c => c.id) } }
    })
    
    process.stdout.write(`✅ Deleted ${deleteResult.count} companies\n`)
  }

  // Unlink and delete companies with jobs
  if (withJobs.length > 0) {
    process.stdout.write(`\n🔗 Unlinking jobs from ${withJobs.length} bad company records...\n`)
    
    for (const company of withJobs) {
      await prisma.job.updateMany({
        where: { companyId: company.id },
        data: { companyId: null }
      })
    }
    
    const deleteResult = await prisma.company.deleteMany({
      where: { id: { in: withJobs.map(c => c.id) } }
    })
    
    process.stdout.write(`✅ Unlinked and deleted ${deleteResult.count} companies\n`)
  }

  const remaining = await prisma.company.count()
  process.stdout.write(`\n📈 Remaining companies: ${remaining}\n`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())