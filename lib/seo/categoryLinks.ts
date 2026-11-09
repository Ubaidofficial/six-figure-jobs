// lib/seo/categoryLinks.ts
//
// Where the chips on a /jobs/category/<category> page point.
//
// They used to be built with buildJobsPath, the salary-first /jobs/<band>-<role>-jobs form. That form now 308-redirects:
// to the plain role page (so the 100k+/200k+/300k+/400k+ chips all landed on the same page) or, for a country or remote
// prefix, to /jobs; and for a role with no page of its own ("sales", "marketing") it is a 404. A crawl on 2026-11-09 found
// 10 broken and 113 redirecting links, all from these chips. These are the real final URLs.

import { isTier1Role } from '../roles/canonicalSlugs'

const BANDS = [
  { slug: '100k-plus', min: 100_000 },
  { slug: '200k-plus', min: 200_000 },
  { slug: '300k-plus', min: 300_000 },
  { slug: '400k-plus', min: 400_000 },
] as const

/** The salary floors a category page offers a chip for. */
export const SALARY_BAND_MINS: readonly number[] = BANDS.map((b) => b.min)

/** The first role in the category with its own pages, or null (Marketing has none: its slugs are aliases or 404). */
export function categoryLinkRole(roleSlugs: readonly string[]): string | null {
  return roleSlugs.find((slug) => isTier1Role(slug)) ?? null
}

/**
 * 100k+ to 400k+: that role's salary-band pages, or the site-wide band pages when the category has no role page.
 * A role's band page redirects to the role page when no job in the role pays that much, so `bandsWithJobs` (the floors
 * that have jobs, from the same query the band page runs) leaves those chips out. The site-wide pages always exist.
 */
export function categorySalaryChips(
  roleSlugs: readonly string[],
  bandsWithJobs?: ReadonlySet<number>,
): Array<{ label: string; href: string }> {
  const role = categoryLinkRole(roleSlugs)
  return BANDS.filter((b) => !role || !bandsWithJobs || bandsWithJobs.has(b.min)).map((b) => ({
    label: `${b.slug.replace('-plus', '')}+`,
    href: role ? `/jobs/${role}/${b.slug}` : `/jobs/${b.slug}`,
  }))
}

/** A country goes to its country page (a role-and-country page redirects there); remote goes to the role's remote page. */
export function categoryLocationHref(roleSlugs: readonly string[], code: string): string {
  if (code === 'remote') {
    const role = categoryLinkRole(roleSlugs)
    return role ? `/remote/${role}` : '/remote'
  }
  return `/jobs/location/${code}`
}
