// lib/jobs/remoteRegions.ts
//
// What "remote in <region>" means on this site, in one place.
//
// The stored `remoteRegion` column is not usable for this: ingest stamps "Global" on every remote job that has no
// region (lib/ingest/index.ts), so on the live site it holds only "Global" (capitalised), and every regional filter that
// compared it to "us-only", "emea" ... matched nothing. A job's country is real data, so a region here is a set of
// countries; a remote job counts for a region when its country is in the set. A job stored with the region slug itself
// (older pipeline) still matches.

import type { Prisma } from '@prisma/client'

// ISO 3166-1 alpha-2.
const EUROPE_EX_UK = [
  'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT',
  'XK', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI',
  'ES', 'SE', 'CH', 'UA', 'VA',
] as const
const EUROPE = [...EUROPE_EX_UK, 'GB'] as const
const MIDDLE_EAST = ['AE', 'BH', 'EG', 'IL', 'IQ', 'IR', 'JO', 'KW', 'LB', 'OM', 'PS', 'QA', 'SA', 'SY', 'TR', 'YE'] as const
const AFRICA = ['ZA', 'NG', 'KE', 'GH', 'MA', 'TN', 'DZ', 'ET', 'TZ', 'UG', 'SN', 'CI', 'RW'] as const
const APAC = [
  'AU', 'NZ', 'JP', 'SG', 'IN', 'CN', 'HK', 'KR', 'TW', 'ID', 'MY', 'TH', 'PH', 'VN', 'PK', 'BD', 'LK', 'NP', 'KH', 'MM',
] as const

export type RemoteRegionDef = {
  slug: string
  /** Short label for chips and filters. */
  label: string
  /** "<label> remote jobs" heading form. */
  heading: string
  /** Countries whose remote jobs belong to this region; null for the "no country" bucket. */
  countries: readonly string[] | null
  /** Shown before the label: a flag code (ISO, or EU) or an emoji for regions with no single flag. */
  mark: string
}

export const REMOTE_REGIONS: readonly RemoteRegionDef[] = [
  { slug: 'global', label: 'Anywhere in the world', heading: 'Worldwide Remote Jobs', countries: null, mark: '🌍' },
  { slug: 'us-only', label: 'US', heading: 'US Remote Jobs', countries: ['US'], mark: 'US' },
  { slug: 'canada', label: 'Canada', heading: 'Canada Remote Jobs', countries: ['CA'], mark: 'CA' },
  { slug: 'australia', label: 'Australia', heading: 'Australia Remote Jobs', countries: ['AU'], mark: 'AU' },
  { slug: 'uk-ireland', label: 'UK & Ireland', heading: 'UK & Ireland Remote Jobs', countries: ['GB', 'IE'], mark: 'GB' },
  { slug: 'europe', label: 'Europe', heading: 'Europe Remote Jobs', countries: EUROPE, mark: 'EU' },
  { slug: 'middle-east', label: 'Middle East', heading: 'Middle East Remote Jobs', countries: MIDDLE_EAST, mark: '🌍' },
  { slug: 'apac', label: 'Asia-Pacific', heading: 'Asia-Pacific Remote Jobs', countries: APAC, mark: '🌏' },
  // Kept so existing links and the homepage / search dropdowns keep working. Not shown as a chip.
  { slug: 'emea', label: 'EMEA', heading: 'EMEA Remote Jobs', countries: [...EUROPE, ...MIDDLE_EAST, ...AFRICA], mark: '🌍' },
]

/** The regions shown as chips on the Remote hub, in order. */
/** Regions offered in the listing sidebars (/jobs, role and salary pages): all but EMEA, which stays reachable by URL only. */
export const LISTING_REMOTE_REGIONS = REMOTE_REGIONS.filter((r) => r.slug !== 'emea')

export const REMOTE_HUB_CHIP_SLUGS = ['global', 'us-only', 'canada', 'australia', 'europe', 'middle-east', 'apac'] as const

/**
 * The regions to show as chips on the hub. With counts, a region with no remote jobs is left out (never a chip that
 * opens an empty page); the region being viewed stays. Without counts all of them show.
 */
export function visibleHubRegionSlugs(
  counts: Readonly<Record<string, number>> | null | undefined,
  active: string | null,
): string[] {
  return REMOTE_HUB_CHIP_SLUGS.filter((slug) => !counts || (counts[slug] ?? 0) > 0 || slug === active)
}

const BY_SLUG = new Map(REMOTE_REGIONS.map((r) => [r.slug, r]))

export function remoteRegionDef(slug: string | null | undefined): RemoteRegionDef | null {
  return slug ? (BY_SLUG.get(String(slug).trim().toLowerCase()) ?? null) : null
}

/** A region slug from a URL, or null when it is not one we know. */
export function normalizeRemoteRegionSlug(raw: string | string[] | undefined | null): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return remoteRegionDef(v)?.slug ?? null
}

/** Same predicate as the `remoteOnly` filter in queryJobs. */
export const REMOTE_JOB_CLAUSE: Prisma.JobWhereInput = { OR: [{ remote: true }, { remoteMode: 'remote' }] }

// "Anywhere in the world" needs the posting to say so. A remote job with no country is not enough: on the live site
// (2026-11-09) most of the 1,021 such jobs read "Remote (US)", "San Francisco Bay Area or Remote (U.S.)" or a US city.
const WORLDWIDE_WORDS = ['worldwide', 'anywhere', 'global'] as const
// ...and to name no place or time zone that limits it: "Anywhere in the US", "Global (EMEA)", "Remote - anywhere, EST".
// Read loosely on purpose: leaving out a truly worldwide job is better than offering a US-only one to the world.
const LIMITING_WORDS = [
  ' us', '(us', 'us)', 'u.s', 'usa', 'united states', 'america', 'canada', ' uk', '(uk', 'united kingdom', 'britain',
  'europe', 'emea', 'apac', 'asia', 'latam', 'africa', 'australia', 'india', 'germany', 'time zone', 'timezone', 'utc',
  'gmt', 'cet', ' est', ' pst', ' cst',
] as const
const LIMITING_PREFIXES = ['us ', 'us-', 'us,', 'uk ', 'uk-', 'uk,'] as const

/** True when a remote job's location text says it can be done from anywhere, and names nothing that limits it. */
export function isWorldwideLocationText(text: string | null | undefined): boolean {
  const t = String(text ?? '').toLowerCase()
  return (
    WORLDWIDE_WORDS.some((w) => t.includes(w)) &&
    !LIMITING_WORDS.some((w) => t.includes(w)) &&
    !LIMITING_PREFIXES.some((p) => t.startsWith(p))
  )
}

/** The database form of isWorldwideLocationText, for remote jobs with no country (the same words, the same rules). */
const WORLDWIDE_CLAUSE: Prisma.JobWhereInput = {
  AND: [
    REMOTE_JOB_CLAUSE,
    { countryCode: null },
    { OR: WORLDWIDE_WORDS.map((w) => ({ locationRaw: { contains: w, mode: 'insensitive' as const } })) },
    {
      NOT: {
        OR: [
          ...LIMITING_WORDS.map((w) => ({ locationRaw: { contains: w, mode: 'insensitive' as const } })),
          ...LIMITING_PREFIXES.map((p) => ({ locationRaw: { startsWith: p, mode: 'insensitive' as const } })),
        ],
      },
    },
  ],
}

/**
 * The filter for "remote jobs in <region>". An unknown slug keeps the old behaviour (an exact match on the stored
 * region) so nothing that worked before stops working.
 */
export function remoteRegionWhere(slug: string): Prisma.JobWhereInput {
  const def = remoteRegionDef(slug)
  if (!def) return { remoteRegion: slug }
  const stored: Prisma.JobWhereInput = { remoteRegion: { equals: def.slug, mode: 'insensitive' } }
  if (def.countries === null) return WORLDWIDE_CLAUSE
  return { AND: [REMOTE_JOB_CLAUSE, { OR: [{ countryCode: { in: [...def.countries] } }, stored] }] }
}

/** Remote jobs per region from per-country counts and the worldwide count (pure; the database part is in siteCounts). */
export function countRemoteByRegion(
  remoteByCountry: ReadonlyArray<{ code: string; count: number }>,
  remoteWorldwide: number,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of REMOTE_REGIONS) {
    if (def.countries === null) {
      out[def.slug] = remoteWorldwide
      continue
    }
    const set = new Set(def.countries)
    out[def.slug] = remoteByCountry.reduce((sum, c) => (set.has(c.code.toUpperCase()) ? sum + c.count : sum), 0)
  }
  return out
}

/** Markets of the homepage "pay floor" panel: each is a set of countries (Europe here excludes the UK, which has its own row). */
export const FLOOR_MARKET_COUNTRIES: Record<string, readonly string[]> = {
  USD: ['US'],
  GBP: ['GB'],
  EUR: EUROPE_EX_UK,
  CAD: ['CA'],
  AUD: ['AU'],
}
