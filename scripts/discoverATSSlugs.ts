import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function testATS(type: string, slug: string): Promise<boolean> {
  const urls: Record<string, string> = {
    greenhouse: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    lever: `https://api.lever.co/v0/postings/${slug}`,
    ashby: `https://api.ashbyhq.com/posting-api/job-board/${slug}`
  }
  try {
    const res = await fetch(urls[type], { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return false
    const data = await res.json()
    if (type === 'greenhouse') return data.jobs?.length > 0
    if (type === 'lever') return Array.isArray(data) && data.length > 0
    if (type === 'ashby') return data.jobs?.length > 0
    return false
  } catch { return false }
}

function generateSlugs(name: string): string[] {
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, '')
  const base = clean.replace(/\s+/g, '')
  const hyphen = clean.replace(/\s+/g, '-')
  return [...new Set([base, hyphen, base + 'jobs', clean.split(' ')[0]])].filter(s => s.length > 2)
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { atsUrl: null, name: { not: { contains: 'Jobs Posted' } } },
    take: 200
  })
  
  __slog(`\n🔍 Testing ${companies.length} companies...\n`)
  let found = 0
  
  for (const c of companies) {
    process.stdout.write(`${c.name.slice(0, 25).padEnd(25)} `)
    const slugs = generateSlugs(c.name)
    let ok = false
    
    for (const slug of slugs) {
      for (const ats of ['greenhouse', 'lever', 'ashby']) {
        if (await testATS(ats, slug)) {
          const url = ats === 'greenhouse' ? `https://boards.greenhouse.io/${slug}` 
            : ats === 'lever' ? `https://jobs.lever.co/${slug}` 
            : `https://jobs.ashbyhq.com/${slug}`
          await prisma.company.update({ where: { id: c.id }, data: { atsUrl: url } })
          __slog(`✓ ${ats}`)
          found++
          ok = true
          break
        }
      }
      if (ok) break
    }
    if (!ok) __slog('✗')
  }
  
  __slog(`\n✅ Found ${found} new ATS URLs`)
  const total = await prisma.company.count({ where: { atsUrl: { not: null } } })
  __slog(`Total with ATS: ${total}\n`)
  await prisma.$disconnect()
}
main()
