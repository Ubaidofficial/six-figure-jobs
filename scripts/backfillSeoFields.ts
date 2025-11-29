import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Parse experience level from title
function inferExperienceLevel(title: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('intern') || lower.includes('entry')) return 'entry'
  if (lower.includes('lead') || lower.includes('principal') || lower.includes('staff')) return 'lead'
  if (lower.includes('senior') || lower.includes('sr.') || lower.includes('sr ')) return 'senior'
  if (lower.includes('vp') || lower.includes('director') || lower.includes('head of') || lower.includes('chief')) return 'executive'
  return 'mid'
}

// Parse industry from roleSlug or title
function inferIndustry(roleSlug: string | null, title: string): string | null {
  const text = `${roleSlug || ''} ${title}`.toLowerCase()
  if (text.includes('engineer') || text.includes('developer') || text.includes('devops')) return 'engineering'
  if (text.includes('product')) return 'product'
  if (text.includes('design') || text.includes('ux') || text.includes('ui')) return 'design'
  if (text.includes('data') || text.includes('analytics') || text.includes('bi')) return 'data'
  if (text.includes('marketing')) return 'marketing'
  if (text.includes('sales') || text.includes('account')) return 'sales'
  if (text.includes('machine learning') || text.includes('ml ') || text.includes('ai ')) return 'ai-ml'
  return null
}

// Parse work arrangement
function inferWorkArrangement(remoteMode: string | null, remote: boolean | null): string | null {
  if (remoteMode) return remoteMode
  if (remote) return 'remote'
  return null
}

// Parse state code from location
function inferStateCode(city: string | null, countryCode: string | null): string | null {
  if (countryCode !== 'us') return null
  if (!city) return null
  
  const stateMap: Record<string, string> = {
    'san francisco': 'ca', 'los angeles': 'ca', 'san diego': 'ca',
    'new york': 'ny', 'brooklyn': 'ny', 'manhattan': 'ny',
    'austin': 'tx', 'dallas': 'tx', 'houston': 'tx',
    'seattle': 'wa', 'boston': 'ma', 'chicago': 'il',
    'denver': 'co', 'atlanta': 'ga', 'miami': 'fl'
  }
  
  return stateMap[city.toLowerCase()] || null
}

async function backfill() {
  console.log('Starting SEO fields backfill...')
  
  const jobs = await prisma.job.findMany({
    where: { isExpired: false },
    select: { id: true, title: true, roleSlug: true, remoteMode: true, remote: true, city: true, countryCode: true }
  })
  
  console.log(`Processing ${jobs.length} jobs...`)
  
  let updated = 0
  for (const job of jobs) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        experienceLevel: inferExperienceLevel(job.title),
        industry: inferIndustry(job.roleSlug, job.title),
        workArrangement: inferWorkArrangement(job.remoteMode, job.remote),
        stateCode: inferStateCode(job.city, job.countryCode)
      }
    })
    updated++
    if (updated % 1000 === 0) console.log(`Updated ${updated}/${jobs.length}`)
  }
  
  console.log(`✅ Backfilled ${updated} jobs`)
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect())