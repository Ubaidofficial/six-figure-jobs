import { PrismaClient } from '@prisma/client'
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import type { AtsProvider } from '../lib/scrapers/ats/types'

const prisma = new PrismaClient()
const UA = 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)'

async function fetchWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(id)
    return { ok: res.ok, status: res.status }
  } catch (err: any) {
    clearTimeout(id)
    return { ok: false, status: err?.name === 'AbortError' ? 408 : 500 }
  }
}

async function checkBoardEndpoints() {
  const endpoints = [
    ['RemoteOK', 'https://remoteok.com'],
    ['WeWorkRemotely', 'https://weworkremotely.com'],
    ['NoDesk', 'https://nodesk.co/remote-jobs'],
    ['BuiltIn', 'https://builtin.com/jobs/remote'],
    ['RemoteRocketship', 'https://www.remoterocketship.com'],
    ['Remotive', 'https://remotive.com/remote-jobs'],
    ['YCombinator', 'https://www.ycombinator.com/jobs'],
    ['RemoteAI', 'https://remoteai.io'],
    ['RemoteOtter', 'https://remoteotter.com'],
    ['FourDayWeek', 'https://4dayweek.io'],
    ['Trawle', 'https://trawle.io'],
    ['RealWorkFromAnywhere', 'https://realworkfromanywhere.com'],
    ['JustJoin', 'https://justjoin.it'],
  ] as const

  console.log('🌐 Board endpoint smoke check')
  for (const [name, url] of endpoints) {
    const { ok, status } = await fetchWithTimeout(url)
    console.log(`  ${name.padEnd(22)} ${ok ? 'OK' : 'FAIL'} (status ${status})`)
  }
  console.log('')
}

async function checkAtsProviders() {
  const providers: AtsProvider[] = [
    'greenhouse',
    'lever',
    'ashby',
    'workday',
    'smartrecruiters',
    'teamtailor',
    'breezy',
    'recruitee',
    'workable',
  ]

  console.log('🏢 ATS fetch smoke check (no DB writes)')

  for (const provider of providers) {
    const company = await prisma.company.findFirst({
      where: { atsProvider: provider, atsUrl: { not: null } },
      select: { name: true, atsUrl: true },
      orderBy: { updatedAt: 'desc' },
    })

    if (!company?.atsUrl) {
      console.log(`  ${provider.padEnd(16)} SKIP (no company with atsUrl)`)
      continue
    }

    try {
      const jobs = await scrapeCompanyAtsJobs(provider, company.atsUrl)
      console.log(
        `  ${provider.padEnd(16)} OK – ${jobs.length} jobs from ${company.name}`,
      )
    } catch (err: any) {
      console.log(
        `  ${provider.padEnd(16)} FAIL – ${err?.message || String(err)}`,
      )
    }
  }

  console.log('')
}

async function main() {
  await checkBoardEndpoints()
  await checkAtsProviders()
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
