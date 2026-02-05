// scripts/backfillLocations.ts
//
// Backfill Job location fields from locationRaw:
// - city, citySlug, countryCode
// - remoteMode / remote when explicitly indicated (remote/hybrid/onsite)
// - workArrangement from remoteMode/remote

import { format as __format } from 'node:util'
import slugify from 'slugify'
import { prisma } from '../lib/prisma'
import { normalizeLocation, isNonCityLabel } from '../lib/normalizers/location'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

function envInt(name: string, def: number) {
  const v = process.env[name]
  if (!v) return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function countryToCode(country: string | null | undefined): string | null {
  if (!country) return null

  const map: Record<string, string> = {
    'united states': 'US',
    'united kingdom': 'GB',
    canada: 'CA',
    germany: 'DE',
    france: 'FR',
    netherlands: 'NL',
    spain: 'ES',
    italy: 'IT',
    australia: 'AU',
    'new zealand': 'NZ',
    sweden: 'SE',
    norway: 'NO',
    denmark: 'DK',
    finland: 'FI',
    switzerland: 'CH',
    ireland: 'IE',
    poland: 'PL',
    portugal: 'PT',
    brazil: 'BR',
    mexico: 'MX',
    india: 'IN',
    singapore: 'SG',
  }

  return map[country.toLowerCase()] ?? null
}

function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = String(raw).trim()
  if (!cleaned) return null
  const upper = cleaned.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper)) return upper
  return countryToCode(cleaned)
}

function coercePrimaryLocation(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const v: any = value
    if (typeof v.locationRaw === 'string') return v.locationRaw
    if (typeof v.label === 'string') return v.label
  }
  return null
}

function parseLocationsJson(value: unknown): Array<Record<string, any>> {
  if (!value) return []
  if (Array.isArray(value)) return value as Array<Record<string, any>>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function extractFromLocationsJson(value: unknown): {
  city?: string
  region?: string
  country?: string
  raw?: string
} | null {
  const rows = parseLocationsJson(value)
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const city = typeof row.city === 'string' ? row.city : typeof row.cityName === 'string' ? row.cityName : null
    const region = typeof row.state === 'string' ? row.state : typeof row.region === 'string' ? row.region : null
    const country =
      typeof row.countryCode === 'string'
        ? row.countryCode
        : typeof row.country === 'string'
          ? row.country
          : null
    if (city || country) {
      const parts = [city, region, country].filter(Boolean)
      return {
        city: city ?? undefined,
        region: region ?? undefined,
        country: country ?? undefined,
        raw: parts.length ? parts.join(', ') : undefined,
      }
    }
  }
  return null
}

const INVALID_CITY_SLUGS = new Set([
  'remote',
  'anywhere',
  'anywhere-in-the-world',
  'anywhere-in-world',
  'worldwide',
  'global',
  'world',
  'europe',
  'emea',
  'apac',
  'latam',
  'americas',
  'north-america',
  'south-america',
  'asia',
  'asia-pacific',
  'middle-east',
  'africa',
  'us',
  'usa',
  'uk',
  'united-states',
  'united-kingdom',
  'canada',
  'germany',
  'france',
  'spain',
  'italy',
  'australia',
  'new-zealand',
  'india',
  'singapore',
])

function normalizeCityCandidate(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (isNonCityLabel(trimmed)) return null
  return trimmed
}

function isInvalidCitySlug(slug: string | null | undefined): boolean {
  if (!slug) return false
  const key = String(slug).toLowerCase().trim()
  return INVALID_CITY_SLUGS.has(key)
}

function inferWorkArrangement(remoteMode: string | null, remote: boolean | null): string | null {
  if (remoteMode) return remoteMode
  if (remote) return 'remote'
  return null
}

async function main() {
  const limit = envInt('BACKFILL_LOCATIONS_LIMIT', 250)
  const concurrency = envInt('BACKFILL_LOCATIONS_CONCURRENCY', 12)
  const dryRun = process.argv.includes('--dry-run')

  __slog(`[backfill-locations] starting limit=${limit} dryRun=${dryRun}`)
  __slog(`[backfill-locations] concurrency=${concurrency}`)

  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      OR: [
        {
          AND: [
            {
              OR: [
                { locationRaw: { not: null } },
                { primaryLocation: { not: null } },
                { locationsJson: { not: null } },
              ],
            },
            {
              OR: [
                { citySlug: null },
                { countryCode: null },
                { remoteMode: null },
                { workArrangement: null },
              ],
            },
          ],
        },
        { citySlug: { in: Array.from(INVALID_CITY_SLUGS.values()) } },
      ],
    },
    select: {
      id: true,
      locationRaw: true,
      primaryLocation: true,
      locationsJson: true,
      city: true,
      citySlug: true,
      countryCode: true,
      remote: true,
      remoteMode: true,
      workArrangement: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit > 0 ? limit : undefined,
  })

  __slog(`[backfill-locations] found ${jobs.length} candidate jobs`)

  let updated = 0
  let skipped = 0
  let failed = 0

  let nextProgress = 200

  const processJob = async (job: typeof jobs[number]) => {
    try {
      const rawPrimary = coercePrimaryLocation(job.primaryLocation)
      const fromLocations = extractFromLocationsJson(job.locationsJson)
      const rawStructured = fromLocations?.raw ?? rawPrimary
      const raw = String(rawStructured || job.locationRaw || '').trim()
      if (!raw) {
        // Still clear invalid city slugs if present
        if (isInvalidCitySlug(job.citySlug) || (job.city && isNonCityLabel(job.city))) {
          if (!dryRun) {
            await prisma.job.update({
              where: { id: job.id },
              data: { city: null, citySlug: null },
            })
          }
          return 'updated' as const
        }
        return 'skipped' as const
      }

      const loc = normalizeLocation(raw)
      const structuredCity = normalizeCityCandidate(fromLocations?.city)
      const structuredCountry = normalizeCountryCode(fromLocations?.country)

      const normalizedCity = normalizeCityCandidate(loc.city)
      const city = structuredCity ?? normalizedCity
      const citySlug = city ? slugify(city, { lower: true, strict: true, trim: true }) : null

      const countryCode = structuredCountry ?? normalizeCountryCode(loc.country)

      const data: Record<string, any> = {}

      if (isInvalidCitySlug(job.citySlug) || (job.city && isNonCityLabel(job.city))) {
        data.city = null
        data.citySlug = null
      }

      if (city && job.city !== city) data.city = city
      if (citySlug && !isInvalidCitySlug(citySlug) && job.citySlug !== citySlug) data.citySlug = citySlug
      if (countryCode && job.countryCode !== countryCode) data.countryCode = countryCode

      // Only override remote flags when explicitly indicated.
      if (loc.kind === 'hybrid') {
        data.remote = false
        data.remoteMode = 'hybrid'
      } else if (loc.kind === 'onsite') {
        data.remote = false
        data.remoteMode = 'onsite'
      } else if (loc.kind === 'remote') {
        data.remote = true
        data.remoteMode = 'remote'
      }

      const nextRemote = typeof data.remote === 'boolean' ? (data.remote as boolean) : job.remote ?? null
      const nextRemoteMode = typeof data.remoteMode === 'string' ? (data.remoteMode as string) : job.remoteMode ?? null
      const nextWorkArrangement = inferWorkArrangement(nextRemoteMode, nextRemote)
      if (nextWorkArrangement && job.workArrangement !== nextWorkArrangement) {
        data.workArrangement = nextWorkArrangement
      }

      if (Object.keys(data).length === 0) return 'skipped' as const

      if (dryRun) {
        __slog(`[backfill-locations] [DRY RUN] ${job.id}`, data)
        return 'updated' as const
      }

      await prisma.job.update({
        where: { id: job.id },
        data,
      })
      return 'updated' as const
    } catch (e: any) {
      __serr(`[backfill-locations] failed job=${job.id}`, e?.message || e)
      return 'failed' as const
    }
  }

  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency)
    const results = await Promise.all(batch.map(processJob))
    for (const r of results) {
      if (r === 'updated') updated++
      else if (r === 'skipped') skipped++
      else failed++
    }
    if (updated >= nextProgress) {
      __slog(`[backfill-locations] progress updated=${updated} total=${jobs.length}`)
      while (updated >= nextProgress) nextProgress += 200
    }
  }

  __slog(`[backfill-locations] done updated=${updated} skipped=${skipped} failed=${failed}`)
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
