import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


// Use pooled URL with longer timeout to avoid connection pool timeouts
const baseUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  ''
const dbUrl = baseUrl.includes('?')
  ? `${baseUrl}&pool_timeout=30`
  : `${baseUrl}?pool_timeout=30`

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
})

// Broader ATS patterns (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Teamtailor, Breezy, Recruitee, Workable)
const ATS_PATTERNS = [
  { name: 'greenhouse', pattern: /boards\.greenhouse\.io\/([\w-]+)/i, template: 'https://boards.greenhouse.io/$1' },
  { name: 'greenhouse', pattern: /greenhouse\.io\/(?:embed\/)?job_board\?.*for=([\w-]+)/i, template: 'https://boards.greenhouse.io/$1' },
  { name: 'lever', pattern: /jobs\.lever\.co\/([^\/\s"']+)/i, template: 'https://jobs.lever.co/$1' },
  { name: 'ashby', pattern: /jobs\.ashbyhq\.com\/([^\/\s"']+)/i, template: 'https://jobs.ashbyhq.com/$1' },
  { name: 'workday', pattern: /https?:\/\/([^\.]+)\.wd\d+\.myworkdayjobs\.com\/[^"']+/i, template: 'https://$1.wd5.myworkdayjobs.com' },
  { name: 'workday', pattern: /https?:\/\/([^\.]+)\.myworkdayjobs\.com\/[^"']+/i, template: 'https://$1.myworkdayjobs.com' },
  { name: 'smartrecruiters', pattern: /careers\.smartrecruiters\.com\/([^\/\s"']+)/i, template: 'https://careers.smartrecruiters.com/$1' },
  { name: 'teamtailor', pattern: /jobs\.teamtailor\.com\/companies\/([^\/\s"']+)/i, template: 'https://jobs.teamtailor.com/companies/$1' },
  { name: 'breezy', pattern: /breezy\.hr\/companies\/([^\/\s"']+)/i, template: 'https://breezy.hr/companies/$1' },
  { name: 'recruitee', pattern: /recruitee\.com\/o\/([^\/\s"']+)/i, template: 'https://$1.recruitee.com' },
  { name: 'workable', pattern: /apply\.workable\.com\/([^\/\s"']+)/i, template: 'https://apply.workable.com/$1' },
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
  const batch = 500
  let skip = 0
  let foundTotal = 0
  let processedTotal = 0

  while (true) {
    const companies = await prisma.company.findMany({
      where: { atsUrl: null, website: { not: null }, name: { not: 'Add Your Company' } },
      take: batch,
      skip,
    })

    if (companies.length === 0) break

    __slog(`\n🔍 Scanning ${companies.length} companies (skip=${skip})...\n`)

    for (const c of companies) {
      processedTotal++
      process.stdout.write(`${c.name.slice(0,30).padEnd(30)} `)
      const result = await findATS(c.name, c.website)

      if (result) {
        await prisma.company.update({ where: { id: c.id }, data: { atsUrl: result.url, atsProvider: result.ats } })
        __slog(`✓ ${result.ats}`)
        foundTotal++
      } else {
        __slog('✗')
      }
    }

    skip += companies.length
    if (companies.length < batch) break
  }

  __slog(`\n✅ Found ${foundTotal} new ATS URLs (processed ${processedTotal})`)
  const total = await prisma.company.count({ where: { atsUrl: { not: null } } })
  __slog(`Total with ATS: ${total}\n`)

  await prisma.$disconnect()
}
main()
