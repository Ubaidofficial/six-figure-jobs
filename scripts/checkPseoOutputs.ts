import { appendFile } from 'node:fs/promises'

import { prisma } from '../lib/prisma'
import { resolveCoreSitemapFamilies } from '../lib/seo/coreSitemapFamilies'
import { resolveOptionalSitemapFamilies } from '../lib/seo/optionalSitemapFamilies'

const ALL_CORE_FAMILIES = ['jobs', 'company', 'salary', 'category', 'level', 'browse'] as const
const ALL_OPTIONAL_FAMILIES = ['city', 'remote', 'country', 'slices'] as const

type CoreFamilyKey = (typeof ALL_CORE_FAMILIES)[number]
type OptionalFamilyKey = (typeof ALL_OPTIONAL_FAMILIES)[number]

function parseRequiredFamilies<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  const requested = (raw ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return requested.filter((value): value is T => allowed.includes(value as T))
}

function statusLabel(value: boolean): 'ok' | 'missing' {
  return value ? 'ok' : 'missing'
}

async function appendStepSummary(lines: string[]) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return
  await appendFile(summaryPath, `${lines.join('\n')}\n`)
}

async function main() {
  const requiredCoreFamilies = parseRequiredFamilies(
    process.env.REQUIRED_PSEO_CORE_FAMILIES || 'salary,category,level,browse',
    ALL_CORE_FAMILIES,
  )
  const requiredOptionalFamilies = parseRequiredFamilies(
    process.env.REQUIRED_PSEO_OPTIONAL_FAMILIES,
    ALL_OPTIONAL_FAMILIES,
  )

  const [coreState, optionalState] = await Promise.all([
    resolveCoreSitemapFamilies('checkPseoOutputs'),
    resolveOptionalSitemapFamilies('checkPseoOutputs'),
  ])

  const coreStatuses: Record<CoreFamilyKey, boolean> = {
    jobs: coreState.hasJobUrls,
    company: coreState.hasCompanyUrls,
    salary: coreState.hasSalaryUrls,
    category: coreState.hasCategoryUrls,
    level: coreState.hasLevelUrls,
    browse: coreState.hasBrowseUrls,
  }

  const optionalStatuses: Record<OptionalFamilyKey, boolean> = {
    city: optionalState.cityUrls.length > 0,
    remote: optionalState.hasRemoteUrls,
    country: optionalState.hasCountryUrls,
    slices: optionalState.hasSliceUrls,
  }

  const missingRequiredCoreFamilies = requiredCoreFamilies.filter((family) => !coreStatuses[family])
  const missingRequiredOptionalFamilies = requiredOptionalFamilies.filter(
    (family) => !optionalStatuses[family],
  )

  const failureMessages = [
    ...(missingRequiredCoreFamilies.length > 0
      ? [`missing required core families: ${missingRequiredCoreFamilies.join(', ')}`]
      : []),
    ...(missingRequiredOptionalFamilies.length > 0
      ? [`missing required optional families: ${missingRequiredOptionalFamilies.join(', ')}`]
      : []),
    ...(coreState.failedFamilies.length > 0
      ? [`core family resolution failed: ${coreState.failedFamilies.join(', ')}`]
      : []),
    ...(optionalState.failedFamilies.length > 0
      ? [`optional family resolution failed: ${optionalState.failedFamilies.join(', ')}`]
      : []),
  ]

  console.log('=== pSEO Output Guard ===')
  console.log(`requiredCoreFamilies=${requiredCoreFamilies.join(',') || 'none'}`)
  console.log(`requiredOptionalFamilies=${requiredOptionalFamilies.join(',') || 'none'}`)

  console.log('coreFamilyStatus:')
  for (const family of ALL_CORE_FAMILIES) {
    console.log(`- ${family}: ${statusLabel(coreStatuses[family])}`)
  }

  console.log('optionalFamilyStatus:')
  console.log(`- city: ${statusLabel(optionalStatuses.city)} (urls=${optionalState.cityUrls.length})`)
  for (const family of ALL_OPTIONAL_FAMILIES.filter((value) => value !== 'city')) {
    console.log(`- ${family}: ${statusLabel(optionalStatuses[family])}`)
  }

  if (coreState.failedFamilies.length > 0) {
    console.log(`coreFamilyResolutionFailures=${coreState.failedFamilies.join(',')}`)
  }
  if (optionalState.failedFamilies.length > 0) {
    console.log(`optionalFamilyResolutionFailures=${optionalState.failedFamilies.join(',')}`)
  }

  await appendStepSummary([
    '## pSEO Output Guard',
    `- Status: ${failureMessages.length > 0 ? 'fail' : 'pass'}`,
    `- Required core families: ${requiredCoreFamilies.join(', ') || 'none'}`,
    `- Required optional families: ${requiredOptionalFamilies.join(', ') || 'none'}`,
    '',
    '### Core Families',
    ...ALL_CORE_FAMILIES.map((family) => `- ${family}: ${statusLabel(coreStatuses[family])}`),
    '',
    '### Optional Families',
    `- city: ${statusLabel(optionalStatuses.city)} (urls=${optionalState.cityUrls.length})`,
    ...ALL_OPTIONAL_FAMILIES.filter((family) => family !== 'city').map(
      (family) => `- ${family}: ${statusLabel(optionalStatuses[family])}`,
    ),
    ...(coreState.failedFamilies.length > 0
      ? ['', `- Core resolver failures: ${coreState.failedFamilies.join(', ')}`]
      : []),
    ...(optionalState.failedFamilies.length > 0
      ? ['', `- Optional resolver failures: ${optionalState.failedFamilies.join(', ')}`]
      : []),
    ...(failureMessages.length > 0
      ? ['', '### Failure Reasons', ...failureMessages.map((message) => `- ${message}`)]
      : []),
    '',
  ])

  if (failureMessages.length > 0) {
    throw new Error(`pSEO output guard failed: ${failureMessages.join(' | ')}`)
  }
}

main().catch((error) => {
  console.error('[checkPseoOutputs] error:', error)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
