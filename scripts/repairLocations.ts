// scripts/repairLocations.ts
/**
 * Phase 4 – Location Repair / Audit
 *
 * Goals:
 *  - Audit and repair location normalization for Job records:
 *    • Ensure countryCode is filled when possible (US, GB, CA, etc.)
 *    • Normalize city / citySlug using normalizeLocation()
 *    • Normalize remote + remoteMode flags using coerceRemoteFlag()
 *
 * Usage:
 *
 *  Audit only (no writes):
 *    npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/repairLocations.ts --mode=audit --dry-run --limit=500
 *
 *  Full audit (no writes, all jobs):
 *    npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/repairLocations.ts --mode=audit --dry-run
 *
 *  Repair (writes to DB – be careful):
 *    npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/repairLocations.ts --mode=repair
 */

import { format as __format } from 'node:util'
import { PrismaClient, Prisma, Job } from '@prisma/client'
import slugify from 'slugify'
import {
  normalizeLocation,
  coerceRemoteFlag,
  type NormalizedLocation,
} from '../lib/normalizers/location'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()

type Mode = 'audit' | 'repair'

interface CliOptions {
  mode: Mode
  dryRun: boolean
  limit: number | null
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)

  const getArg = (name: string): string | null => {
    const idx = args.indexOf(name)
    if (idx === -1) return null
    return args[idx + 1] ?? null
  }

  const modeArg = (getArg('--mode') || 'audit').toLowerCase()
  const mode: Mode = modeArg === 'repair' ? 'repair' : 'audit'

  const dryRun = args.includes('--dry-run')

  const limitArg = getArg('--limit')
  const limit = limitArg ? Number(limitArg) || null : null

  return { mode, dryRun, limit }
}

/**
 * Map normalized country names → ISO-like 2-letter codes
 * aligned with salary COUNTRY_TO_CURRENCY mapping.
 */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'GB',
  Canada: 'CA',
  Germany: 'DE',
  France: 'FR',
  Netherlands: 'NL',
  Spain: 'ES',
  Italy: 'IT',
  Australia: 'AU',
  'New Zealand': 'NZ',
  Sweden: 'SE',
  Norway: 'NO',
  Denmark: 'DK',
  Finland: 'FI',
  Switzerland: 'CH',
  Ireland: 'IE',
  Poland: 'PL',
  Portugal: 'PT',
  Brazil: 'BR',
  Mexico: 'MX',
  India: 'IN',
  Singapore: 'SG',
}

/**
 * Convert NormalizedLocation.country ("United States") -> "US" etc.
 */
function countryNameToCode(country: string | null): string | null {
  if (!country) return null
  const code = COUNTRY_NAME_TO_CODE[country]
  return code ?? null
}

/**
 * Build a normalized view of the job's location using your helper.
 */
function getNormalized(job: Job): NormalizedLocation {
  return normalizeLocation(job.locationRaw ?? null)
}

async function main() {
  const { mode, dryRun, limit } = parseCliArgs()

  __slog('🌍 Phase 4 – Location Repair / Audit')
  __slog(`   Mode    : ${mode}`)
  __slog(`   Dry run : ${dryRun ? 'YES (no writes)' : 'no'}`)
  __slog(`   Limit   : ${limit ?? 'none'}`)
  __slog('')

  // We care about jobs that have some location/remote info at all
  const whereClause: Prisma.JobWhereInput = {
    OR: [
      { locationRaw: { not: null } },
      { city: { not: null } },
      { countryCode: { not: null } },
      { remote: { not: null } },
      { remoteMode: { not: null } },
    ],
  }

  const jobs = await prisma.job.findMany({
    where: whereClause,
    take: limit ?? undefined,
  })

  __slog(`🔍 Loaded ${jobs.length} jobs with location/remote data`)
  if (jobs.length === 0) {
    __slog('✅ Nothing to do, exiting.')
    await prisma.$disconnect()
    return
  }

  let scanned = 0
  let missingCountry = 0
  let fixedCountry = 0
  let changedCountry = 0
  let changedCity = 0
  let changedCitySlug = 0
  let changedRemoteFlags = 0
  let updatedJobs = 0

  const updates: Array<Promise<Job>> = []

  for (const job of jobs) {
    scanned++

    const normalized = getNormalized(job)

    const data: Partial<Job> = {}

    // ---- Country / countryCode ----
    const oldCountryCode = job.countryCode ?? null
    const normalizedCountryCode = countryNameToCode(normalized.country)

    if (!oldCountryCode && normalizedCountryCode) {
      data.countryCode = normalizedCountryCode
      fixedCountry++
    } else if (oldCountryCode && normalizedCountryCode && oldCountryCode !== normalizedCountryCode) {
      data.countryCode = normalizedCountryCode
      changedCountry++
    }

    if (!oldCountryCode && !normalizedCountryCode) {
      missingCountry++
    }

    // ---- City / citySlug ----
    const oldCity = job.city ?? null
    const newCity = normalized.city ?? oldCity

    if (newCity && newCity !== oldCity) {
      data.city = newCity
      changedCity++
    }

    // Only generate a slug if we have a city
    if (newCity) {
      const newSlug = slugify(newCity, { lower: true, strict: true })
      if (newSlug && newSlug !== job.citySlug) {
        data.citySlug = newSlug
        changedCitySlug++
      }
    }

    // ---- Remote flags / remoteMode ----
    const inferredRemote = coerceRemoteFlag(job.remote, normalized)
    const oldRemote = job.remote
    const oldRemoteMode = job.remoteMode ?? null

    let newRemoteMode: string | null = oldRemoteMode

    if (normalized.kind === 'remote') newRemoteMode = 'remote'
    else if (normalized.kind === 'hybrid') newRemoteMode = 'hybrid'
    else if (normalized.kind === 'onsite') newRemoteMode = 'onsite'

    let remoteChanged = false

    if (inferredRemote !== null && inferredRemote !== oldRemote) {
      data.remote = inferredRemote
      remoteChanged = true
    }

    if (newRemoteMode !== oldRemoteMode) {
      data.remoteMode = newRemoteMode
      remoteChanged = true
    }

    if (remoteChanged) {
      changedRemoteFlags++
    }

    const hasAnyUpdate = Object.keys(data).length > 0
    if (!hasAnyUpdate) continue

    updatedJobs++

    if (dryRun || mode === 'audit') {
      if (updatedJobs <= 20) {
        __slog(
          `• [DRY RUN] Job ${job.id} (${job.title}) – ` +
            `countryCode: ${oldCountryCode ?? 'null'} → ${data.countryCode ?? oldCountryCode ?? 'null'}, ` +
            `city: ${oldCity ?? 'null'} → ${data.city ?? oldCity ?? 'null'}, ` +
            `remote: ${String(oldRemote)} → ${String(
              data.remote ?? oldRemote
            )}, ` +
            `remoteMode: ${oldRemoteMode ?? 'null'} → ${data.remoteMode ?? oldRemoteMode ?? 'null'}`
        )
      }
      continue
    }

    // Repair mode – actually write to DB
    updates.push(
      prisma.job.update({
        where: { id: job.id },
        data,
      })
    )
  }

  if (mode === 'repair' && !dryRun && updates.length > 0) {
    __slog(`💾 Applying ${updates.length} job location updates...`)
    await Promise.all(updates)
  }

  __slog('')
  __slog('📊 Location Summary')
  __slog('-------------------')
  __slog(`Jobs scanned                         : ${scanned}`)
  __slog(`Jobs still missing countryCode       : ${missingCountry}`)
  __slog(`Jobs where countryCode was filled in : ${fixedCountry}`)
  __slog(`Jobs where countryCode changed       : ${changedCountry}`)
  __slog(`Jobs where city changed              : ${changedCity}`)
  __slog(`Jobs where citySlug changed          : ${changedCitySlug}`)
  __slog(`Jobs with remote flags updated       : ${changedRemoteFlags}`)
  if (mode === 'repair') {
    __slog(
      `Jobs ${dryRun ? 'that WOULD be ' : ''}updated      : ${updatedJobs}`
    )
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  __serr('💥 Error in repairLocations.ts')
  __serr(err)
  prisma
    .$disconnect()
    .catch(() => {
      // ignore
    })
    .finally(() => {
      process.exit(1)
    })
})
