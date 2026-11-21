// lib/jobs/listingFacets.ts
//
// The sidebar counts of the listing pages (/jobs, role, salary tier, country): Remote / Hybrid / On-site and the remote regions.
// Each was its own count over the whole job table: a cold role page ran 11 of them (3 + 8) and 5 more for company sizes (see
// levelSizeFacets.ts), each a full scan with the base listing filter (measured 2026-11-21: 21 of the 39 queries of a cold page
// were counts, 63% of the query time; in production the site-wide ones took 3.6-4.4 s each).
//
// When the visitor has not chosen a work type or a region (the plain page a crawler fetches), the same numbers come from two
// grouped queries and a little code. With either filter chosen the base of the counts differs (the counts of one family keep the
// other family's filter), so the separate counts run exactly as before.
import { prisma } from '../prisma'
import { buildWhere, type JobQueryInput } from './queryJobs'
import { REMOTE_JOB_CLAUSE, isWorldwideLocationText, regionsForLocationText, remoteRegionDef } from './remoteRegions'

export type WorkTypeCounts = { remote: number; hybrid: number; onsite: number }
export type RegionRef = { slug: string }
export type FacetCounts = { workTypes: WorkTypeCounts; regions: number[] }

/** Jobs by (work type, remote flag, country, stored region): everything the work type and region counts need except text. */
export type ModeRow = { remoteMode: string | null; remote: boolean | null; countryCode: string | null; remoteRegion: string | null; count: number }
/** Remote jobs with no country, by stored region and location text: the part of a region that is read from text. */
export type NoCountryRow = { remoteRegion: string | null; locationRaw: string | null; count: number }

export function workTypesFromRows(rows: readonly ModeRow[]): WorkTypeCounts {
  const out: WorkTypeCounts = { remote: 0, hybrid: 0, onsite: 0 }
  for (const row of rows) {
    if (row.remoteMode === 'remote' || row.remoteMode === 'hybrid' || row.remoteMode === 'onsite') out[row.remoteMode] += row.count
  }
  return out
}

const storedRegionIs = (stored: string | null, slug: string) => stored != null && stored.toLowerCase() === slug

/**
 * Jobs per region, the way remoteRegionWhere (lib/jobs/remoteRegions.ts) selects them, from grouped rows (pure):
 *  - "global" (anywhere in the world): a remote job with no country whose text says so and names nothing that limits it;
 *  - any other region: a remote job whose country is in the region, or whose stored region is the region, or (no country) whose
 *    location text names the region and leaves nothing out. A job is counted once: a no-country job whose stored region
 *    already matches is in the first group, not again for its text.
 */
export function regionCountsFromRows(regions: readonly RegionRef[], rows: readonly ModeRow[], noCountry: readonly NoCountryRow[]): number[] {
  const remoteRows = rows.filter((r) => r.remote === true || r.remoteMode === 'remote')
  return regions.map((region) => {
    const def = remoteRegionDef(region.slug)
    if (!def) return 0
    if (def.countries === null) {
      return noCountry.reduce((sum, r) => (isWorldwideLocationText(r.locationRaw) ? sum + r.count : sum), 0)
    }
    const countries = new Set(def.countries)
    const byCountryOrStored = remoteRows.reduce(
      (sum, r) => ((r.countryCode != null && countries.has(r.countryCode)) || storedRegionIs(r.remoteRegion, def.slug) ? sum + r.count : sum),
      0,
    )
    const byText = noCountry.reduce(
      (sum, r) => (!storedRegionIs(r.remoteRegion, def.slug) && regionsForLocationText(r.locationRaw).includes(def.slug) ? sum + r.count : sum),
      0,
    )
    return byCountryOrStored + byText
  })
}

/** The counts as separate queries, as the pages ran them before (used when a work type or region filter is chosen). */
async function loadSeparately(base: JobQueryInput, regions: readonly RegionRef[]): Promise<FacetCounts> {
  const [remote, hybrid, onsite, regionCounts] = await Promise.all([
    prisma.job.count({ where: buildWhere({ ...base, remoteMode: 'remote' }) }),
    prisma.job.count({ where: buildWhere({ ...base, remoteMode: 'hybrid' }) }),
    prisma.job.count({ where: buildWhere({ ...base, remoteMode: 'onsite' }) }),
    Promise.all(regions.map((r) => prisma.job.count({ where: buildWhere({ ...base, remoteRegion: r.slug }) }))),
  ])
  return { workTypes: { remote, hybrid, onsite }, regions: regionCounts }
}

/** Work type counts and region counts for a listing page's sidebar; `regions` may be empty (the country pages have none). */
export async function loadWorkTypeAndRegionCounts(base: JobQueryInput, regions: readonly RegionRef[]): Promise<FacetCounts> {
  const canMerge = !base.remoteMode && !base.remoteRegion && regions.every((r) => remoteRegionDef(r.slug))
  if (!canMerge) return loadSeparately(base, regions)

  const where = buildWhere({ ...base, remoteMode: undefined, remoteRegion: undefined })
  const [modeGroups, noCountryGroups] = await Promise.all([
    prisma.job.groupBy({ by: ['remoteMode', 'remote', 'countryCode', 'remoteRegion'], where, _count: { _all: true } }),
    regions.length
      ? prisma.job.groupBy({ by: ['remoteRegion', 'locationRaw'], where: { AND: [where, REMOTE_JOB_CLAUSE, { countryCode: null }] }, _count: { _all: true } })
      : Promise.resolve([]),
  ])
  const rows: ModeRow[] = modeGroups.map((g) => ({
    remoteMode: g.remoteMode,
    remote: g.remote,
    countryCode: g.countryCode,
    remoteRegion: g.remoteRegion,
    count: g._count._all,
  }))
  const noCountry: NoCountryRow[] = noCountryGroups.map((g) => ({ remoteRegion: g.remoteRegion, locationRaw: g.locationRaw, count: g._count._all }))
  return { workTypes: workTypesFromRows(rows), regions: regionCountsFromRows(regions, rows, noCountry) }
}
