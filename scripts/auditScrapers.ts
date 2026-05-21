import { format as __format } from 'node:util'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { BOARD_SCRAPERS } from '../lib/scrapers/boardRegistry'
import { SUPPORTED_ATS_PROVIDERS } from '../lib/scrapers/ats/types'
import { classifyGenericCareerSource } from '../lib/scrapers/utils/companyCareersDiscovery'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()
const SCRAPERS_DIR = path.resolve(process.cwd(), 'lib/scrapers')
const ATS_DIR = path.resolve(SCRAPERS_DIR, 'ats')

type Check = {
  key: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

function add(checks: Check[], key: string, ok: boolean, detail: string, warn = false) {
  checks.push({
    key,
    status: ok ? 'pass' : warn ? 'warn' : 'fail',
    detail,
  })
}

function formatChecks(checks: Check[]) {
  const statusIcon = {
    pass: 'PASS',
    warn: 'WARN',
    fail: 'FAIL',
  } as const

  const counts = {
    pass: checks.filter((check) => check.status === 'pass').length,
    warn: checks.filter((check) => check.status === 'warn').length,
    fail: checks.filter((check) => check.status === 'fail').length,
  }

  return [
    '=== Scraper Audit ===',
    `pass=${counts.pass} warn=${counts.warn} fail=${counts.fail}`,
    '',
    ...checks.map((check) => `${statusIcon[check.status]} ${check.key}: ${check.detail}`),
  ].join('\n')
}

function findDuplicateScraperArtifacts() {
  const files = readdirSync(SCRAPERS_DIR)
  const byBase = new Map<string, Set<string>>()

  for (const file of files) {
    if (!/\.(ts|js)$/.test(file)) continue
    const ext = path.extname(file)
    const base = path.basename(file, ext)
    const set = byBase.get(base) ?? new Set<string>()
    set.add(ext)
    byBase.set(base, set)
  }

  return Array.from(byBase.entries())
    .filter(([, exts]) => exts.has('.ts') && exts.has('.js'))
    .map(([base]) => base)
    .sort()
}

function findAtsDebugWrites() {
  return readdirSync(ATS_DIR)
    .filter((file) => file.endsWith('.ts'))
    .filter((file) => /writeFileSync|appendFileSync|\/tmp\//.test(readFileSync(path.join(ATS_DIR, file), 'utf8')))
    .sort()
}

async function auditBoardRegistry(checks: Check[]) {
  const keys = BOARD_SCRAPERS.map((scraper) => scraper.key)
  const names = BOARD_SCRAPERS.map((scraper) => scraper.name)
  const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index)
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index)
  const missingProbeUrls = BOARD_SCRAPERS.filter(
    (scraper) => !scraper.probeUrl && scraper.probeMode !== 'dynamic',
  )
  const dynamicProbeSets = BOARD_SCRAPERS.filter((scraper) => scraper.probeMode === 'dynamic')
  const invalidRuns = BOARD_SCRAPERS.filter((scraper) => typeof scraper.run !== 'function')

  add(checks, 'board-registry.keys', duplicateKeys.length === 0, duplicateKeys.length ? `duplicate keys: ${duplicateKeys.join(', ')}` : `${keys.length} unique keys`)
  add(checks, 'board-registry.names', duplicateNames.length === 0, duplicateNames.length ? `duplicate names: ${duplicateNames.join(', ')}` : `${names.length} unique names`)
  add(
    checks,
    'board-registry.probe-urls',
    missingProbeUrls.length === 0,
    missingProbeUrls.length
      ? `missing probe urls: ${missingProbeUrls.map((scraper) => scraper.key).join(', ')}`
      : dynamicProbeSets.length
        ? `static probe urls valid; dynamic probe sets: ${dynamicProbeSets.map((scraper) => scraper.key).join(', ')}`
        : 'all board scrapers declare a probe url',
  )
  add(checks, 'board-registry.runnables', invalidRuns.length === 0, invalidRuns.length ? `non-function run handlers: ${invalidRuns.map((scraper) => scraper.key).join(', ')}` : 'all board scrapers expose callable run handlers')
}

async function auditAtsRegistry(checks: Check[]) {
  const supportedSet = new Set<string>(SUPPORTED_ATS_PROVIDERS)

  add(
    checks,
    'ats-registry.supported-providers',
    SUPPORTED_ATS_PROVIDERS.length > 0,
    `supported providers: ${SUPPORTED_ATS_PROVIDERS.join(', ')}`,
  )

  try {
    const companyRows = await prisma.company.groupBy({
      by: ['atsProvider'],
      where: {
        atsProvider: { not: null },
        atsUrl: { not: null },
      },
      _count: { _all: true },
    })

    const unsupportedCompanies = companyRows
      .filter((row): row is typeof row & { atsProvider: string } => typeof row.atsProvider === 'string' && !supportedSet.has(row.atsProvider))
      .sort((a, b) => a.atsProvider.localeCompare(b.atsProvider))

    const companyAtsRows = await prisma.companyATS.groupBy({
      by: ['atsType'],
      where: { isActive: true },
      _count: { _all: true },
    })

    const unsupportedDiscovered = companyAtsRows
      .filter((row) => !supportedSet.has(row.atsType))
      .sort((a, b) => a.atsType.localeCompare(b.atsType))

    add(
      checks,
      'ats-registry.company-table',
      unsupportedCompanies.length === 0,
      unsupportedCompanies.length
        ? `unsupported providers stored on Company: ${unsupportedCompanies.map((row) => `${row.atsProvider}=${row._count._all}`).join(', ')}`
        : 'Company table only contains supported ATS providers',
      unsupportedCompanies.length > 0,
    )
    add(
      checks,
      'ats-registry.discovery-table',
      unsupportedDiscovered.length === 0,
      unsupportedDiscovered.length
        ? `unsupported ATS discovered in CompanyATS: ${unsupportedDiscovered.map((row) => `${row.atsType}=${row._count._all}`).join(', ')}` 
        : 'CompanyATS active rows only contain supported ATS providers',
      unsupportedDiscovered.length > 0,
    )
  } catch (error) {
    add(
      checks,
      'ats-registry.database',
      false,
      `database audit unavailable: ${error instanceof Error ? error.message : String(error)}`,
      true,
    )
  }
}

async function auditGenericSources(checks: Check[]) {
  try {
    const sources = await prisma.companySource.findMany({
      where: {
        sourceType: 'generic_careers_page',
        isActive: true,
      },
      select: {
        url: true,
        company: {
          select: {
            website: true,
          },
        },
      },
      take: 5000,
    })

    const invalid = sources.filter(
      (source) => !classifyGenericCareerSource(source.url, source.company.website).valid,
    )

    add(
      checks,
      'generic-sources.inventory',
      invalid.length === 0,
      invalid.length
        ? `invalid active generic sources: ${invalid.length}/${sources.length}`
        : `active generic sources validated: ${sources.length}`,
      invalid.length > 0,
    )
  } catch (error) {
    add(
      checks,
      'generic-sources.database',
      false,
      `generic source audit unavailable: ${error instanceof Error ? error.message : String(error)}`,
      true,
    )
  }
}

function auditFilesystemHygiene(checks: Check[]) {
  const duplicateArtifacts = findDuplicateScraperArtifacts()
  const debugWriteFiles = findAtsDebugWrites()

  add(
    checks,
    'filesystem.duplicate-artifacts',
    duplicateArtifacts.length === 0,
    duplicateArtifacts.length
      ? `duplicate .ts/.js scraper artifacts: ${duplicateArtifacts.join(', ')}`
      : 'no duplicate .ts/.js scraper artifacts detected',
    duplicateArtifacts.length > 0,
  )
  add(
    checks,
    'filesystem.debug-writes',
    debugWriteFiles.length === 0,
    debugWriteFiles.length
      ? `debug file writes still present in: ${debugWriteFiles.join(', ')}`
      : 'no ATS scraper debug file writes detected',
  )
}

async function main() {
  const checks: Check[] = []

  await auditBoardRegistry(checks)
  await auditAtsRegistry(checks)
  await auditGenericSources(checks)
  auditFilesystemHygiene(checks)

  const output = formatChecks(checks)
  const hasFailure = checks.some((check) => check.status === 'fail')

  if (hasFailure) {
    __serr(output)
    process.exitCode = 1
  } else {
    __slog(output)
  }
}

main()
  .catch((error) => {
    __serr(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
