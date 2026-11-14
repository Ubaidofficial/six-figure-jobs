// lib/seo/metaText.ts
//
// Pure helpers for <title> and meta description text. No Prisma, no Next imports, so they unit-test cleanly.
//
// Google truncates by pixel width, not characters (roughly 580-600px for titles, ~920px for descriptions on
// desktop), so these limits are conventions that keep the part that earns the click inside the visible text.
import { SITE_NAME } from './site'

/**
 * Hard limit for any <title>. Search results show roughly the first 60 characters, and site audits (OpenSEO)
 * flag anything longer, so 60 is the cap: templates drop the brand suffix first, then optional words.
 */
export const TITLE_MAX = 60
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
    // "6-figure" and "high-paying" are how many people search for these jobs ("6 figure jobs", "high paying jobs");
    // the title and H1 already say "Six Figure Jobs" / "Six-figure jobs" (2026-11-09).
    `${totalJobs.toLocaleString()}+ high-paying 6-figure jobs ($100k+) from ${totalCompanies.toLocaleString()}+ companies.`,
    [
      [
        'Salary shown upfront, no entry-level noise. Remote and on-site roles.',
        'Salary shown upfront, no entry-level noise.',
        'Salary shown upfront.',
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

/**
 * Company page title. Leads with "<Company> Jobs", the way people search for an employer's openings ("openai jobs");
 * long names fall back, never overflow.
 */
export function buildCompanyPageTitle(name: string, jobCount: number): string {
  const n = jobCount.toLocaleString()
  return fitTitle([
    `${name} Jobs: ${n} Openings Paying $100k+ | ${SITE_NAME}`,
    `${name} Jobs: ${n} Openings Paying $100k+`,
    `${name} Jobs: ${n} Openings | ${SITE_NAME}`,
    `${name} Jobs: ${n} Openings`,
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

/**
 * /companies title. The directory lists only companies with `minJobs`+ open jobs, a subset of every company hiring
 * (the number the home page quotes), so the title says which companies it counts.
 */
export function buildCompaniesIndexTitle(totalCompanies: number, minJobs: number): string {
  if (totalCompanies <= 0) return fitTitle([`Companies Hiring $100k+ Roles | ${SITE_NAME}`, 'Companies Hiring $100k+ Roles'])
  const lead = `${totalCompanies.toLocaleString()} Companies With ${minJobs}+ Open $100k+ Jobs`
  return fitTitle([`${lead} | ${SITE_NAME}`, lead])
}

/**
 * /companies description (meta only; the CollectionPage JSON-LD keeps its own text). The directory is the companies
 * with `minJobs`+ open jobs; `totalCompaniesHiring` (every company with an open job, as on the home page) is quoted
 * beside it so the two numbers never read as a contradiction.
 */
export function buildCompaniesIndexDescription(
  totalCompanies: number,
  totalEligibleJobs: number,
  totalCompaniesHiring: number,
  minJobs: number,
): string {
  if (totalCompanies <= 0) {
    return buildDescription('Companies hiring for $100k+ tech jobs.', [
      ['Six-figure roles at top startups and high-growth companies, salary shown upfront.'],
    ])
  }
  const outOf =
    totalCompaniesHiring > totalCompanies ? `, out of ${totalCompaniesHiring.toLocaleString()} companies hiring` : ''
  return buildDescription(
    `${totalCompanies.toLocaleString()} companies with ${minJobs}+ open $100k+ jobs (${totalEligibleJobs.toLocaleString()} jobs between them)${outOf}.`,
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
 * /jobs hub title: "six-figure jobs" and "high-paying jobs" are the two ways people search for what this page lists
 * (keyword research, 2026-11-11). Not "tech": the hub also lists sales, finance, legal and operations roles.
 * `pageSuffix` is " (Page 2)" style text for deeper pages.
 */
export function buildJobsHubTitle(total: number | null, pageSuffix = ''): string {
  return buildListingTitle({
    topic: 'Six-Figure Jobs',
    count: total,
    qualifier: `— High-Paying $100k+ Roles${pageSuffix}`,
  })
}

/** /jobs hub description with the live count. Pass the same total the page shows, so the two never disagree. */
export function buildJobsHubDescription(total: number | null): string {
  return buildListingDescription(`${countPrefix(total ?? 0)}high-paying $100k+ jobs open now.`, [
    ['Filter by role, country, remote work or seniority.', 'Filter by role, country or seniority.'],
  ])
}

/**
 * Salary-tier page title ("5,753 Jobs That Pay $100k–$199k a Year | Six Figure Jobs"), worded the way people search
 * for these jobs ("jobs that pay 100k a year", "jobs that pay 200k").
 */
export function buildSalaryTierTitle(rangeLabel: string, total: number): string {
  return buildListingTitle({ topic: `Jobs That Pay ${rangeLabel} a Year`, count: total })
}

/** Salary-tier page description with the live count. */
export function buildSalaryTierDescription(rangeLabel: string, total: number): string {
  if (total <= 0) return buildDescription(`Browse jobs that pay ${rangeLabel} a year.`, [SALARY_SHOWN])
  return buildListingDescription(`${countPrefix(total)}jobs that pay ${rangeLabel} a year, open now.`, [
    ['Filter by role, country, remote work or seniority.', 'Filter by role or country.'],
  ])
}

/** City page title ("1,234 High-Paying Jobs in Austin ($100k+) | Six Figure Jobs"); fits TITLE_MAX for any city. */
export function buildCityTitle(cityLabel: string, salaryLabel: string, total: number): string {
  return buildListingTitle({ topic: `High-Paying Jobs in ${cityLabel}`, count: total, qualifier: `(${salaryLabel})` })
}

/** Countries whose name takes "the" in running text ("jobs in the United States", not "jobs in United States"). */
const COUNTRIES_WITH_THE = new Set(['United States', 'United Kingdom', 'Netherlands', 'United Arab Emirates', 'Philippines'])

/** "the United States" for the countries that take "the", else the label as is. For "jobs in ${...}" phrases. */
export function inCountry(countryLabel: string): string {
  return COUNTRIES_WITH_THE.has(countryLabel) ? `the ${countryLabel}` : countryLabel
}

/** Country page title ("1,637 High-Paying Jobs in Canada (C$120k+) | Six Figure Jobs"). */
export function buildCountryTitle(countryLabel: string, salaryLabel: string, total: number): string {
  return buildListingTitle({
    topic: `High-Paying Jobs in ${inCountry(countryLabel)}`,
    count: total,
    qualifier: `(${salaryLabel})`,
  })
}

/** Skill page title ("674 Python Jobs Paying $100k+ | Six Figure Jobs"), the same shape as role pages. */
export function buildSkillTitle(skillLabel: string, total: number): string {
  return buildListingTitle({ topic: `${skillLabel} Jobs`, count: total, qualifier: 'Paying $100k+' })
}

/**
 * Role salary guide title. Leads with "<Role> Salary", the way people search ("software engineer salary"), and the
 * median when the page has one ("Software Engineer Salary: $229k Median | Six Figure Jobs").
 */
export function buildSalaryGuideTitle(roleName: string, bandLabel: string, medianUsd: number | null): string {
  const median = medianUsd ? `$${Math.round(medianUsd / 1000)}k Median` : null
  return fitTitle([
    ...(median ? [`${roleName} Salary: ${median} | ${SITE_NAME}`, `${roleName} Salary: ${median}`] : []),
    `${roleName} Salary Guide (${bandLabel}) | ${SITE_NAME}`,
    `${roleName} Salary Guide (${bandLabel})`,
    `${roleName} Salary`,
  ])
}

/** Category page title ("1,420 Engineering Jobs Paying $100k+ | Six Figure Jobs"), the same shape as role pages. */
export function buildCategoryTitle(categoryLabel: string, total: number): string {
  return buildListingTitle({ topic: `${categoryLabel} Jobs`, count: total, qualifier: 'Paying $100k+' })
}
