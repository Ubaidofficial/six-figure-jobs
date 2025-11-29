import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const ATS_PATTERNS = [
  { name: 'greenhouse', pattern: /boards\.greenhouse\.io\/(\w+)/i, template: 'https://boards.greenhouse.io/$1' },
  { name: 'lever', pattern: /jobs\.lever\.co\/([^\/\s"']+)/i, template: 'https://jobs.lever.co/$1' },
  { name: 'ashby', pattern: /jobs\.ashbyhq\.com\/([^\/\s"']+)/i, template: 'https://jobs.ashbyhq.com/$1' },
]

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
      redirect: 'follow'
    })
    clearTimeout(timeout)
    return res.ok ? await res.text() : null
  } catch {
    clearTimeout(timeout)
    return null
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function findATS(name: string, website?: string | null) {
  const slug = slugify(name)
  const urls = website 
    ? [`${website.replace(/\/$/, '')}/careers`, `${website.replace(/\/$/, '')}/jobs`]
    : [`https://${slug}.com/careers`, `https://${slug}.io/careers`, `https://www.${slug}.com/careers`]

  for (const url of urls) {
    const html = await fetchPage(url)
    if (!html) continue
    for (const { name: ats, pattern, template } of ATS_PATTERNS) {
      const match = html.match(pattern)
      if (match && match[1] !== 'embed' && match[1].length > 2) {
        return { ats, url: template.replace('$1', match[1]) }
      }
    }
  }
  return null
}

async function main() {
  // Focus on companies with websites first (more likely to succeed)
  const companies = await prisma.company.findMany({
    where: { atsUrl: null, website: { not: null }, name: { not: 'Add Your Company' } },
    take: 50
  })
  
  console.log(`\n🔍 Scanning ${companies.length} companies with websites...\n`)
  
  let found = 0
  for (const c of companies) {
    process.stdout.write(`${c.name.slice(0,30).padEnd(30)} `)
    const result = await findATS(c.name, c.website)
    
    if (result) {
      await prisma.company.update({ where: { id: c.id }, data: { atsUrl: result.url } })
      console.log(`✓ ${result.ats}`)
      found++
    } else {
      console.log('✗')
    }
  }
  
  console.log(`\n✅ Found ${found} new ATS URLs`)
  const total = await prisma.company.count({ where: { atsUrl: { not: null } } })
  console.log(`Total with ATS: ${total}\n`)
  
  await prisma.$disconnect()
}
main()
