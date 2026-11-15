// lib/research/payReportLinks.ts
//
// Where a row of the Six-Figure Job Pay Report links to on the site. A link is made only when the destination is known to exist,
// decided by the same lists the destination pages use (an unknown slug there is a 404 or a redirect), never by guessing:
//   role     /jobs/<slug>             only a canonical role slug (app/jobs/[role] redirects anything else)
//   city     /jobs/city/<slug>        only a city in CITY_TARGETS
//   level    /jobs/level/<slug>       only a level in LEVEL_TARGETS (Director and VP have no page, so they are not linked)
//   skill    /jobs/skills/<slug>      only a skill in SKILL_TARGETS
//   employer /company/<slug>          only when the edition's data carries the company's own slug (from the research query)
// Links carry no query string: the listing pages mark a URL with any non-pagination parameter noindex, so a tracking parameter on
// an internal link would turn the page it points to into a noindex page.
import { resolveSkillSlug } from '../jobs/skillSlug'
import { isCanonicalSlug } from '../roles/canonicalSlugs'
import { CITY_TARGETS, LEVEL_TARGETS, SKILL_TARGETS } from '../seo/pseoTargets'

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function roleHref(label: string): string | undefined {
  const slug = slugify(label)
  return isCanonicalSlug(slug) ? `/jobs/${slug}` : undefined
}

export function cityHref(label: string): string | undefined {
  const city = CITY_TARGETS.find((c) => c.label.toLowerCase() === label.trim().toLowerCase())
  return city ? `/jobs/city/${city.slug}` : undefined
}

/** The stored seniority labels that have a matching level page. Staff has none of its own: "Lead / Staff" is the page that covers it. */
const LEVEL_FOR_LABEL: Record<string, string> = { senior: 'senior', lead: 'lead', staff: 'lead' }

export function levelHref(label: string): string | undefined {
  const slug = LEVEL_FOR_LABEL[label.trim().toLowerCase()]
  return slug && slug in LEVEL_TARGETS ? `/jobs/level/${slug}` : undefined
}

export function skillHref(label: string): string | undefined {
  const slug = resolveSkillSlug(label)
  return slug && SKILL_TARGETS.some((s) => s.slug === slug) ? `/jobs/skills/${slug}` : undefined
}

export function employerHref(row: { slug?: string }): string | undefined {
  return row.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) ? `/company/${row.slug}` : undefined
}

/**
 * One link per destination in a table: the first row that reaches a page keeps the link, later rows to the same page do not
 * (two rows linking to one page add nothing for a reader, and chains of identical links look like padding).
 */
export function uniqueHrefs(hrefs: Array<string | undefined>): Array<string | undefined> {
  const seen = new Set<string>()
  return hrefs.map((href) => {
    if (!href || seen.has(href)) return undefined
    seen.add(href)
    return href
  })
}
