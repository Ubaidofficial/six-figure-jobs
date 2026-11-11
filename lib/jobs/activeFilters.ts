// lib/jobs/activeFilters.ts
//
// The filters a listing page's URL has turned on, as removable chips for the bar above the results ("Showing 412 jobs ·
// Remote ✕ · £150k+ ✕ · Clear all"). Pure: the same parameters the filter panel writes and the pages read.
import { countryName } from '../location/country'
import { remoteRegionDef } from './remoteRegions'
import { salaryFilterCurrency, salaryFilterLabel } from './salaryFilter'

export type ActiveFilterChip = {
  /** Unique within the list, for React keys. */
  key: string
  label: string
  /** The parameter to remove (with `value`, only that one of a repeatable parameter). */
  param: string
  value?: string
  /** A flag (country code) or mark (region emoji) to show before the label. */
  countryCode?: string
}

type Params = { get(name: string): string | null; getAll(name: string): string[] }

const WORK: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }
const SENIORITY: Record<string, string> = {
  entry: 'Entry level',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff',
  principal: 'Principal',
  lead: 'Lead',
  director: 'Director',
  vp: 'VP',
}

/** Every value of a repeatable parameter (`role=a&role=b` or `role=a,b`), once each. */
export function multiParam(params: Params, name: string): string[] {
  const values = params.getAll(name).flatMap((v) => v.split(','))
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)))
}

export function prettySlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * The chips for the active filters, in the panel's order. `pinned` lists parameters the page itself fixes (a country
 * page's country, a salary tier's range), which have no chip because they cannot be removed there.
 */
export function activeFilterChips(params: Params, pinned: readonly string[] = []): ActiveFilterChip[] {
  const skip = new Set(pinned)
  const chips: ActiveFilterChip[] = []
  const add = (chip: ActiveFilterChip) => {
    if (!skip.has(chip.param)) chips.push(chip)
  }

  const q = params.get('q')?.trim()
  if (q) add({ key: 'q', label: `“${q}”`, param: 'q' })

  const country = params.get('country')?.trim().toUpperCase() || ''
  const minSalary = Number(params.get('minSalary') || '')
  if (Number.isFinite(minSalary) && minSalary > 100_000) {
    add({ key: 'minSalary', label: salaryFilterLabel(minSalary, salaryFilterCurrency(country)), param: 'minSalary' })
  }

  const remoteMode = params.get('remoteMode') || ''
  if (WORK[remoteMode]) add({ key: 'remoteMode', label: WORK[remoteMode], param: 'remoteMode' })

  if (country) {
    const name = countryName(country, { short: true })
    if (name) add({ key: 'country', label: name, param: 'country', countryCode: country })
  }

  const region = remoteRegionDef(params.get('remoteRegion'))
  if (region) add({ key: 'remoteRegion', label: region.slug === 'global' ? 'Anywhere in the world' : `Remote · ${region.label}`, param: 'remoteRegion' })

  for (const role of multiParam(params, 'role')) add({ key: `role:${role}`, label: prettySlug(role), param: 'role', value: role })
  for (const s of multiParam(params, 'seniority')) {
    add({ key: `seniority:${s}`, label: SENIORITY[s] ?? prettySlug(s), param: 'seniority', value: s })
  }
  for (const size of multiParam(params, 'companySize')) {
    add({ key: `companySize:${size}`, label: `${size.replace('-', '–')} employees`, param: 'companySize', value: size })
  }

  const tech = params.get('tech')?.trim()
  if (tech) add({ key: 'tech', label: tech, param: 'tech' })
  if (params.get('visa') === '1') add({ key: 'visa', label: 'Visa sponsorship', param: 'visa' })

  return chips
}

/** The parameters "Clear all" removes (everything the panel and chips can set). */
export const FILTER_PARAMS = [
  'q',
  'exact',
  'minSalary',
  'remoteMode',
  'country',
  'remoteRegion',
  'role',
  'seniority',
  'companySize',
  'tech',
  'visa',
] as const
