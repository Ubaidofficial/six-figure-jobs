import { prisma } from '../lib/prisma'
import { normalizeLocation } from '../lib/normalizers/location'
import { normalizeLocationRaw, hasMultiLocationSignals } from '../lib/location/locationRaw'

function inferRemoteRegionFromScope(lr: string): string | null {
  // lr is normalized (lowercase, separators preserved)
  if (!lr) return null

  // common scope-only tokens
  if (/(^|[ ,;|/])global([ ,;|/]|$)|(^|[ ,;|/])world( |$)|(^|[ ,;|/])worldwide([ ,;|/]|$)|(^|[ ,;|/])anywhere([ ,;|/]|$)/.test(lr)) {
    return 'global'
  }
  if (/(^|[ ,;|/])emea([ ,;|/]|$)/.test(lr) || /(^|[ ,;|/])europe([ ,;|/]|$)/.test(lr)) return 'emea'
  if (/(^|[ ,;|/])apac([ ,;|/]|$)|(^|[ ,;|/])asia([ ,;|/]|$)/.test(lr)) return 'apac'
  if (/(^|[ ,;|/])latam([ ,;|/]|$)/.test(lr)) return 'latam'

  // US-only-ish
  if (
    /(^|[ ,;|/])(us|usa|united states)([ ,;|/]|$)/.test(lr) &&
    !/(^|[ ,;|/])(canada|uk|united kingdom|europe|emea|apac|latam|global|world|anywhere)([ ,;|/]|$)/.test(lr)
  ) return 'us-only'

  // CA-only-ish
  if (/^canada$|(^|[ ,;|/])canada([ ,;|/]|$)/.test(lr)) return 'canada'

  return null
}

async function main() {
  const DRY_RUN = process.env.DRY_RUN === '1'
  const TAKE = Number(process.env.TAKE ?? '5000')
  const ONLY_SOURCE = process.env.ONLY_SOURCE || ''

  const where: any = { isExpired: false, locationRaw: { not: null } }
  if (ONLY_SOURCE) where.source = ONLY_SOURCE

  const rows = await prisma.job.findMany({
    where,
    select: {
      id: true,
      source: true,
      locationRaw: true,
      remote: true,
      remoteMode: true,
      remoteRegion: true,
      city: true,
      countryCode: true,
    },
    take: TAKE,
    orderBy: { updatedAt: 'desc' },
  })

  let scanned = 0
  let updated = 0

  for (const job of rows) {
    scanned++

    const raw = job.locationRaw ?? ''
    const lr = normalizeLocationRaw(raw)
    const isMulti = hasMultiLocationSignals(lr)
    const nl = normalizeLocation(raw)

    const patch: any = {}

    // Multi-location: we can't reliably store single city/region/country
    if (isMulti) {
      if (job.city !== null) patch.city = null
      // (countryCode is in schema; if you want to clear it only when multi, do it)
      // if (job.countryCode !== null) patch.countryCode = null
    }

    // If normalizer says hybrid/onsite, ensure remote=false and remoteMode matches
    if (nl.kind === 'hybrid') {
      if (job.remote !== false) patch.remote = false
      if (job.remoteMode !== 'hybrid') patch.remoteMode = 'hybrid'
    } else if (nl.kind === 'onsite') {
      if (job.remote !== false) patch.remote = false
      if (job.remoteMode !== 'onsite') patch.remoteMode = 'onsite'
    }

    // Scope-only tokens (USA / Anywhere / Europe) should set remoteRegion for remote boards
    const scopeOnly =
      /^((usa|united states|canada|uk|united kingdom|europe|emea|apac|latam|americas|anywhere|world|global|timezones)(\s*[,;|/]\s*)?)+$/.test(lr)

    if (scopeOnly) {
      // If this is a remote board source, treat as remote
      if (job.source?.startsWith('board:')) {
        if (job.remote !== true) patch.remote = true
        if (job.remoteMode !== 'remote') patch.remoteMode = 'remote'

        const rr = inferRemoteRegionFromScope(lr) ?? (job.remoteRegion ?? null)
        if (!job.remoteRegion && rr) patch.remoteRegion = rr
        if (!job.remoteRegion && !rr) patch.remoteRegion = 'global'
      }
    }

    // Remote=true or remoteMode=remote should always have remoteRegion set (audit expects it)
    const effectiveRemote = (patch.remote ?? job.remote) === true || (patch.remoteMode ?? job.remoteMode) === 'remote'
    if (effectiveRemote) {
      const rr = patch.remoteRegion ?? job.remoteRegion
      if (!rr || rr.trim() === '') patch.remoteRegion = 'global'
      if ((patch.remoteMode ?? job.remoteMode) !== 'remote' && nl.kind === 'remote') patch.remoteMode = 'remote'
    }

    const keys = Object.keys(patch)
    if (keys.length) {
      updated++
      if (!DRY_RUN) {
        await prisma.job.update({ where: { id: job.id }, data: patch })
      } else {
        console.log({ id: job.id, source: job.source, raw: job.locationRaw, patch })
      }
    }
  }

  console.log({ scanned, updated, dryRun: DRY_RUN, take: TAKE, onlySource: ONLY_SOURCE || null })
}

main().finally(() => prisma.$disconnect())
