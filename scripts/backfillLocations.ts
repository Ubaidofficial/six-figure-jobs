// scripts/backfillLocations.ts
//
// Backfill Job location fields from locationRaw:
// - city, citySlug, countryCode
// - remoteMode / remote when explicitly indicated (remote/hybrid/onsite)
// - workArrangement from remoteMode/remote

import { format as __format } from 'node:util'
import slugify from 'slugify'
import { prisma } from '../lib/prisma'
import { normalizeLocation } from '../lib/normalizers/location'

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

function inferWorkArrangement(remoteMode: string | null, remote: boolean | null): string | null {
  if (remoteMode) return remoteMode
  if (remote) return 'remote'
  return null
}

async function main() {
  const limit = envInt('BACKFILL_LOCATIONS_LIMIT', 250)
  const dryRun = process.argv.includes('--dry-run')

  __slog(`[backfill-locations] starting limit=${limit} dryRun=${dryRun}`)

  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      locationRaw: { not: null },
      OR: [{ citySlug: null }, { countryCode: null }, { remoteMode: null }, { workArrangement: null }],
    },
    select: {
      id: true,
      locationRaw: true,
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

  for (const job of jobs) {
    try {
      const raw = String(job.locationRaw || '').trim()
      if (!raw) {
        skipped++
        continue
      }

      const loc = normalizeLocation(raw)
      const countryCode = countryToCode(loc.country)
      const city = loc.city ?? null
      const citySlug = city ? slugify(city, { lower: true, strict: true, trim: true }) : null

      const data: Record<string, any> = {}

      if (city && job.city !== city) data.city = city
      if (citySlug && job.citySlug !== citySlug) data.citySlug = citySlug
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

      if (Object.keys(data).length === 0) {
        skipped++
        continue
      }

      if (dryRun) {
        __slog(`[backfill-locations] [DRY RUN] ${job.id}`, data)
        updated++
        continue
      }

      await prisma.job.update({
        where: { id: job.id },
        data,
      })
      updated++

      if (updated % 200 === 0) {
        __slog(`[backfill-locations] progress updated=${updated} total=${jobs.length}`)
      }
    } catch (e: any) {
      failed++
      __serr(`[backfill-locations] failed job=${job.id}`, e?.message || e)
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

