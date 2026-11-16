// lib/roles/topCities.ts
//
// The "top paying cities" of a role page. The database stores a job's city as a slug ("san-francisco"), and has the same
// city under more than one country code (San Francisco as both US and CA), so the page showed "san-francisco · CA" and
// "san-francisco · US" for one link, and the Related searches card said "jobs in san-francisco". The city pages are the
// ones in CITY_TARGETS, so each city is named and placed by that list, and listed once.
import { CITY_TARGETS } from '../seo/pseoTargets'

const TARGET_BY_SLUG = new Map(CITY_TARGETS.map((c) => [c.slug, c]))

/** Keeps only cities that have a page, once each (the first row wins), named and placed by the city list. */
export function normalizeTopCities<T extends { slug: string; city: string; cc: string }>(cities: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const c of cities) {
    const target = TARGET_BY_SLUG.get(c.slug)
    if (!target || seen.has(c.slug)) continue
    seen.add(c.slug)
    out.push({ ...c, city: target.label, cc: (target.countryCode ?? c.cc).toUpperCase() })
  }
  return out
}
