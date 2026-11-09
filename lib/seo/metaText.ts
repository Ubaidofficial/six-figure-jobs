// lib/seo/metaText.ts
//
// Pure helpers for <title> and meta description text. No Prisma, no Next imports, so they unit-test cleanly.
//
// Google truncates by pixel width, not characters (roughly 580-600px for titles, ~920px for descriptions on
// desktop), so these limits are conventions that keep the part that earns the click inside the visible text.
import { SITE_NAME } from './site'

/** Hard limit for any <title>. Page templates aim for ~60; nothing may go past this. */
export const TITLE_MAX = 65
/** Descriptions aim for 130-155 characters. */
export const DESCRIPTION_MIN = 130
export const DESCRIPTION_MAX = 155

/** Closing phrase for listing descriptions. Only used on pages whose listings are refreshed by the daily ingest. */
export const FRESHNESS = `Updated daily on ${SITE_NAME}.`

/** Cut `text` to at most `max` characters at a word boundary and add an ellipsis. A single over-long word is hard-cut. */
export function truncateAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const room = clean.slice(0, max - 1)
  const lastSpace = room.lastIndexOf(' ')
  const cut = lastSpace > 0 ? room.slice(0, lastSpace) : room
  return `${cut.replace(/[\s,;:|–—-]+$/, '')}…`
}

/** First candidate that fits, else the last (shortest) candidate cut at a word boundary. */
export function fitTitle(candidates: string[], max: number = TITLE_MAX): string {
  const fits = candidates.find((c) => c.length <= max)
  if (fits) return fits
  return truncateAtWord(candidates[candidates.length - 1], max)
}

/**
 * Topic-first title with the brand last. Tries, in order: everything with the brand, everything without it,
 * then topic only. `count` leads the topic ("72 Software Engineer Jobs"); `qualifier` follows it ("Paying $100k+").
 */
export function buildListingTitle(parts: {
  topic: string
  count?: number | null
  qualifier?: string
  brand?: string
}): string {
  const brand = parts.brand ?? SITE_NAME
  const lead = parts.count && parts.count > 0 ? `${parts.count.toLocaleString()} ` : ''
  const full = `${lead}${parts.topic}${parts.qualifier ? ` ${parts.qualifier}` : ''}`
  const short = `${lead}${parts.topic}`
  const candidates = [`${full} | ${brand}`, full, `${short} | ${brand}`, short]
  return fitTitle(candidates)
}

/**
 * Description built as: lead (the live count and subject) + optional slots + a closing phrase.
 * Each slot is a list of alternatives, longest first; slots are filled in order with the longest alternative that
 * still leaves the whole text within `max`. A slot with no fitting alternative is skipped. If the required parts
 * alone are too long, the text is cut at a word boundary.
 */
export function buildDescription(
  lead: string,
  slots: Array<Array<string | null | undefined>>,
  closing: string = FRESHNESS,
  max: number = DESCRIPTION_MAX,
): string {
  const chosen: string[] = []
  const join = (extra: string[]) => [lead, ...extra, closing].filter(Boolean).join(' ')
  for (const slot of slots) {
    const options = slot.filter((s): s is string => Boolean(s))
    const fit = options.find((o) => join([...chosen, o]).length <= max)
    if (fit) chosen.push(fit)
  }
  const text = join(chosen)
  return text.length <= max ? text : truncateAtWord(text, max)
}

/** A sentence about pay that is true for every page we use it on: salary is shown on each listing. */
export const SALARY_SHOWN: string[] = [
  'Salary shown upfront on every listing, with direct links to apply on the employer’s own page.',
  'Salary shown upfront on every listing, with direct links to apply.',
  'Salary shown upfront, with direct links to apply.',
  'Salary shown upfront, direct apply links.',
  'Salary shown upfront.',
]

/**
 * Description for a listing page: `lead` carries the live count and subject ("1,234 $100k+ jobs in Austin."),
 * `extras` are optional filler sentences (each a list of alternatives, longest first) used only if they fit.
 * Pass `count` to omit the leading number when it is zero.
 */
export function buildListingDescription(
  lead: string,
  extras: Array<Array<string | null | undefined>> = [],
): string {
  return buildDescription(lead, [...extras, SALARY_SHOWN])
}

/** "1,234 " when count is positive, else "". For leads like `${countPrefix(n)}$100k+ jobs in Austin.` */
export function countPrefix(count: number): string {
  return count > 0 ? `${count.toLocaleString()} ` : ''
}

/** Home page description: live job and company counts, the benefit, freshness. */
export function buildHomeDescription(totalJobs: number, totalCompanies: number): string {
  return buildDescription(
    `${totalJobs.toLocaleString()}+ jobs paying $100k+ from ${totalCompanies.toLocaleString()}+ companies.`,
    [
      [
        'Salary shown upfront, no entry-level noise. Verified six-figure remote and on-site roles.',
        'Salary shown upfront, no entry-level noise. Remote and on-site roles.',
        'Salary shown upfront, no entry-level noise.',
      ],
    ],
  )
}

/** Role listing description (/jobs/[role]). `avgUsd` is the average of the page's own USD salary data. */
export function buildRoleDescription(roleTitle: string, total: number, avgUsd: number | null): string {
  if (total <= 0) {
    return buildDescription(`Browse ${roleTitle} jobs paying $100k+.`, [SALARY_SHOWN])
  }
  const avg = avgUsd ? Math.round(avgUsd / 1000) : null
  return buildDescription(
    `${total.toLocaleString()} ${roleTitle} jobs paying $100k+${avg ? `, ~$${avg}k average USD salary where listed` : ''}.`,
    [SALARY_SHOWN],
  )
}

/** Company page title. Keeps the established wording when it fits; long names fall back, never overflow. */
export function buildCompanyPageTitle(name: string, jobCount: number): string {
  return fitTitle([
    `${name} $100k+ Jobs - ${jobCount} Open Positions | ${SITE_NAME}`,
    `${name} $100k+ Jobs - ${jobCount} Open Positions`,
    `${name} Jobs - ${jobCount} Open | ${SITE_NAME}`,
    `${name} Jobs - ${jobCount} Open`,
    `${name} Jobs`,
  ])
}

/** Company page description from values the page already computes: count, top hiring areas, highest pay. */
export function buildCompanyPageDescription(
  name: string,
  jobCount: number,
  topRoles: string[],
  highestSalaryLabel: string | null,
): string {
  const roles = topRoles.slice(0, 3)
  const rolesText = roles.length ? `Top roles: ${roles.join(', ')}.` : null
  const rolesShort = roles.length ? `Roles: ${roles.slice(0, 2).join(', ')}.` : null
  const pay = highestSalaryLabel ? `Highest listed pay ${highestSalaryLabel}.` : null
  return buildDescription(`${jobCount.toLocaleString()} $100k+ jobs at ${name}.`, [
    [pay],
    [rolesText, rolesShort],
    ['Salary shown upfront, with direct links to apply.', 'Salary shown upfront.'],
  ])
}

/** /companies description (meta only; the CollectionPage JSON-LD keeps its own text). */
export function buildCompaniesIndexDescription(totalCompanies: number, totalEligibleJobs: number): string {
  if (totalCompanies <= 0) {
    return buildDescription('Companies hiring for $100k+ tech jobs.', [
      ['Six-figure roles at top startups and high-growth companies, salary shown upfront.'],
    ])
  }
  return buildDescription(
    `${totalCompanies.toLocaleString()} companies hiring for ${totalEligibleJobs.toLocaleString()} $100k+ tech jobs.`,
    [
      [
        'Six-figure roles at top startups and high-growth companies, salary shown upfront.',
        'Six-figure roles at top startups, salary shown upfront.',
        'Salary shown upfront.',
      ],
    ],
  )
}

/**
 * /jobs hub title. Keeps the established "Six-Figure Tech Jobs" wording and leads with the live count when it is
 * known. `pageSuffix` is " (Page 2)" style text for deeper pages.
 */
export function buildJobsHubTitle(total: number | null, pageSuffix = ''): string {
  return buildListingTitle({
    topic: 'Six-Figure Tech Jobs',
    count: total,
    qualifier: `— $100k+ Openings${pageSuffix}`,
  })
}

/** /jobs hub description with the live count. Pass the same total the page shows, so the two never disagree. */
export function buildJobsHubDescription(total: number | null): string {
  return buildListingDescription(`${countPrefix(total ?? 0)}$100k+ tech jobs open now.`, [
    ['Filter by role, country, remote work or seniority.', 'Filter by role, country or seniority.'],
  ])
}

/** Salary-tier page title ("1,234 $100k+ Jobs with Published Salaries | Six Figure Jobs"). */
export function buildSalaryTierTitle(rangeLabel: string, total: number): string {
  return buildListingTitle({ topic: `${rangeLabel} Jobs`, count: total, qualifier: 'with Published Salaries' })
}

/** Salary-tier page description with the live count. */
export function buildSalaryTierDescription(rangeLabel: string, total: number): string {
  if (total <= 0) return buildDescription(`Browse ${rangeLabel} jobs.`, [SALARY_SHOWN])
  return buildListingDescription(`${countPrefix(total)}${rangeLabel} jobs open now.`, [
    ['Filter by role, country, remote work or seniority.', 'Filter by role or country.'],
  ])
}
