import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { detectAtsFromUrl } from '../lib/normalizers/ats'

import {
  buildCareerCandidateUrls,
  classifyGenericCareerSource,
  extractCareerPageSignals,
  extractLinkedCareerUrls,
  fetchHtmlPage,
  findAnyAtsFromHtml,
  findSupportedAtsFromHtml,
} from '../lib/scrapers/utils/companyCareersDiscovery'
import { detectATS } from '../lib/scrapers/utils/detectATS'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()

type CliOptions = {
  limit: number
  minJobCount: number
  concurrency: number
  withGeneric: boolean
  write: boolean
}

type CompanyRow = {
  id: string
  name: string
  slug: string
  website: string | null
  jobCount: number
}

type DiscoveryOutcome =
  | {
      kind: 'ats'
      provider: string
      atsUrl: string
      scannedUrl: string
    }
  | {
      kind: 'generic'
      sourceUrl: string
      jobLinks: number
      highSalarySignals: number
    }
  | {
      kind: 'none'
      unsupportedAtsType?: string | null
    }

type DiscoveryRecord = {
  company: string
  outcome: DiscoveryOutcome
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)

  const getValue = (flag: string): string | null => {
    const exact = args.indexOf(flag)
    if (exact !== -1) return args[exact + 1] ?? null
    const withEquals = args.find((arg) => arg.startsWith(`${flag}=`))
    return withEquals ? withEquals.slice(flag.length + 1) : null
  }

  const parsePositiveInt = (value: string | null, fallback: number, max: number): number => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return Math.min(Math.floor(parsed), max)
  }

  return {
    limit: parsePositiveInt(getValue('--limit'), 100, 2000),
    minJobCount: Math.max(0, parsePositiveInt(getValue('--min-job-count'), 0, 100_000)),
    concurrency: parsePositiveInt(getValue('--concurrency'), 6, 16),
    withGeneric: !args.includes('--no-generic'),
    write: args.includes('--write'),
  }
}

async function loadCompanies(options: CliOptions): Promise<CompanyRow[]> {
  return await prisma.company.findMany({
    where: {
      website: { not: null },
      atsUrl: null,
      name: { not: 'Add Your Company' },
      jobCount: { gte: options.minJobCount },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      website: true,
      jobCount: true,
    },
    orderBy: [{ jobCount: 'desc' }, { updatedAt: 'desc' }],
    take: options.limit,
  })
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output: R[] = new Array(items.length)
  let index = 0

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const currentIndex = index++
      output[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  })

  await Promise.all(workers)
  return output
}

async function discoverCompany(company: CompanyRow, options: CliOptions): Promise<DiscoveryOutcome> {
  const website = String(company.website || '').trim()
  if (!website) return { kind: 'none' }

  const directWebsiteAts = detectAtsFromUrl(website)
  if (directWebsiteAts) {
    return {
      kind: 'ats',
      provider: directWebsiteAts.provider,
      atsUrl: directWebsiteAts.atsUrl,
      scannedUrl: website,
    }
  }

  const candidateUrls = new Set<string>(buildCareerCandidateUrls(website))
  const directDetectedType = detectATS(website)
  let unsupportedAtsType: string | null =
    directDetectedType !== 'generic' ? directDetectedType : null

  const homepage = await fetchHtmlPage(website)
  if (homepage?.html) {
    for (const linkedUrl of extractLinkedCareerUrls(homepage.html, homepage.url)) {
      candidateUrls.add(linkedUrl)
    }
  }

  for (const candidateUrl of [...candidateUrls].slice(0, 8)) {
    const page = await fetchHtmlPage(candidateUrl)
    if (!page?.html) continue

    const supportedAts = findSupportedAtsFromHtml(page.html, page.url)
    if (supportedAts) {
      return {
        kind: 'ats',
        provider: supportedAts.provider,
        atsUrl: supportedAts.url,
        scannedUrl: page.url,
      }
    }

    const anyAts = findAnyAtsFromHtml(page.html, page.url)
    if (anyAts?.type && anyAts.type !== 'generic') {
      unsupportedAtsType = anyAts.type
    }

    if (options.withGeneric) {
      const signals = extractCareerPageSignals(page.html, page.url)
      const genericSource = classifyGenericCareerSource(page.url, company.website)
      if (genericSource.valid && signals.jobLinks.length > 0 && signals.highSalarySignals > 0) {
        return {
          kind: 'generic',
          sourceUrl: genericSource.normalizedUrl || page.url,
          jobLinks: signals.jobLinks.length,
          highSalarySignals: signals.highSalarySignals,
        }
      }
    }
  }

  return {
    kind: 'none',
    unsupportedAtsType,
  }
}

async function persistOutcome(company: CompanyRow, outcome: DiscoveryOutcome) {
  if (outcome.kind === 'ats') {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        atsProvider: outcome.provider,
        atsUrl: outcome.atsUrl,
        scrapeStatus: 'ats_discovered',
        scrapeError: null,
      },
    })
    return
  }

  if (outcome.kind === 'generic') {
    await prisma.companySource.upsert({
      where: {
        companyId_url: {
          companyId: company.id,
          url: outcome.sourceUrl,
        },
      },
      create: {
        companyId: company.id,
        url: outcome.sourceUrl,
        sourceType: 'generic_careers_page',
        isActive: true,
        priority: 90,
        scrapeStatus: 'ready',
      },
      update: {
        isActive: true,
        priority: 90,
        scrapeStatus: 'ready',
        scrapeError: null,
      },
    })
  }
}

async function main() {
  const options = parseCliArgs()
  const companies = await loadCompanies(options)

  __slog('=== Company Careers Discovery ===')
  __slog(`mode=${options.write ? 'write' : 'dry-run'}`)
  __slog(`limit=${options.limit}`)
  __slog(`minJobCount=${options.minJobCount}`)
  __slog(`concurrency=${options.concurrency}`)
  __slog(`withGeneric=${options.withGeneric ? 'yes' : 'no'}`)
  __slog(`companies=${companies.length}`)
  __slog('')

  let discoveredAts = 0
  let discoveredGeneric = 0
  let notFound = 0
  const unsupportedCounts = new Map<string, number>()
  const records: DiscoveryRecord[] = []

  await mapLimit(companies, options.concurrency, async (company) => {
    process.stdout.write(`${company.name}...`)
    const outcome = await discoverCompany(company, options)
    records.push({ company: company.name, outcome })

    if (outcome.kind === 'ats') {
      process.stdout.write(` ATS ${outcome.provider}\n`)
      discoveredAts++
    } else if (outcome.kind === 'generic') {
      process.stdout.write(
        ` generic jobs=${outcome.jobLinks} signals=${outcome.highSalarySignals}\n`,
      )
      discoveredGeneric++
    } else {
      process.stdout.write(
        outcome.unsupportedAtsType ? ` unsupported=${outcome.unsupportedAtsType}\n` : ' none\n',
      )
      notFound++
      if (outcome.unsupportedAtsType) {
        unsupportedCounts.set(
          outcome.unsupportedAtsType,
          (unsupportedCounts.get(outcome.unsupportedAtsType) || 0) + 1,
        )
      }
    }

    if (options.write && outcome.kind !== 'none') {
      await persistOutcome(company, outcome)
    }
  })

  __slog('')
  __slog('Summary')
  __slog(`  supported ATS discovered: ${discoveredAts}`)
  __slog(`  generic career sources:   ${discoveredGeneric}`)
  __slog(`  no source found:          ${notFound}`)

  const atsRecords = records.filter((record) => record.outcome.kind === 'ats')
  if (atsRecords.length > 0) {
    __slog('  ATS discoveries:')
    for (const record of atsRecords) {
      const outcome = record.outcome as Extract<DiscoveryOutcome, { kind: 'ats' }>
      __slog(`    ${record.company}: ${outcome.provider} -> ${outcome.atsUrl}`)
    }
  }

  const genericRecords = records.filter((record) => record.outcome.kind === 'generic')
  if (genericRecords.length > 0) {
    __slog('  generic career sources:')
    for (const record of genericRecords) {
      const outcome = record.outcome as Extract<DiscoveryOutcome, { kind: 'generic' }>
      __slog(
        `    ${record.company}: ${outcome.sourceUrl} (jobs=${outcome.jobLinks}, signals=${outcome.highSalarySignals})`,
      )
    }
  }

  if (unsupportedCounts.size > 0) {
    __slog('  unsupported ATS detected:')
    for (const [type, count] of [...unsupportedCounts.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      __slog(`    ${type}: ${count}`)
    }
  }
}

main()
  .catch((error) => {
    __serr('[discoverATS] error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
