// components/home/HeroFilters.tsx
// Homepage search filters. Few-option fields (work arrangement, minimum salary) are pill toggles built from native
// radio inputs, so they submit with the form and work without JavaScript. Long lists (role, location, remote region)
// stay native <select>s, which keeps the phone pickers and screen-reader behaviour, with one consistent style.

import { FilterPills } from '@/components/filters/FilterPills'

import styles from './HeroFilters.module.css'

type Option = { value: string; label: string }

/** Live job counts for the options (from loadSiteCounts); an option with no entry is shown without a count. */
export type HeroFilterCounts = {
  /** Jobs per ISO country code, upper case. */
  countries: Record<string, number>
  /** Remote jobs that can be done from anywhere in the world. */
  remoteWorldwide: number
  workType: { remote: number; hybrid: number; onsite: number }
}

type HeroFiltersProps = {
  roles: Option[]
  locations: Option[]
  /** Remote regions ("global" = anywhere in the world), offered at the top of the Location list. */
  remoteRegions: Option[]
  counts?: HeroFilterCounts | null
}

/** "Germany (1,204)"; the label alone when the count is missing or zero, so no option promises an empty result. */
export function withCount(label: string, count: number | null | undefined): string {
  return count && count > 0 ? `${label} (${count.toLocaleString('en-US')})` : label
}

const WORK: Option[] = [
  { value: '', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]

const SALARY: Option[] = [
  { value: '100000', label: '$100k+' },
  { value: '200000', label: '$200k+' },
  { value: '300000', label: '$300k+' },
  { value: '400000', label: '$400k+' },
]

function SelectField({
  id,
  name,
  label,
  allLabel,
  options,
}: {
  id: string
  name: string
  label: string
  allLabel: string
  options: Option[]
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.selectWrap}>
        <select id={id} name={name} className={styles.select} defaultValue="">
          <option value="">{allLabel}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/**
 * One Location list: remote regions first ("Anywhere in the world" at the top), then countries (ISO codes). Both submit as `country`;
 * /jobs reads a region slug there as a remote region. Replaced a separate "Remote region" select (2026-11-10): asked for
 * the worldwide option in Location, where people look for it.
 */
function LocationField({
  locations,
  regions,
  counts,
}: {
  locations: Option[]
  regions: Option[]
  counts?: HeroFilterCounts | null
}) {
  return (
    <div className={styles.field}>
      <label htmlFor="country" className={styles.label}>
        Location
      </label>
      <div className={styles.selectWrap}>
        <select id="country" name="country" className={styles.select} defaultValue="">
          <option value="">All locations</option>
          <optgroup label="Remote">
            {regions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.value === 'global'
                  ? withCount('🌍 Anywhere in the world (remote)', counts?.remoteWorldwide)
                  : `Remote · ${r.label}`}
              </option>
            ))}
          </optgroup>
          <optgroup label="Country">
            {locations.map((o) => (
              <option key={o.value} value={o.value}>
                {withCount(o.label, counts?.countries[o.value.toUpperCase()])}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  )
}

export function HeroFilters({ roles, locations, remoteRegions, counts }: HeroFiltersProps) {
  const workCounts: Record<string, number | undefined> = {
    remote: counts?.workType.remote,
    hybrid: counts?.workType.hybrid,
    onsite: counts?.workType.onsite,
  }
  const work = WORK.map((o) => ({ ...o, label: withCount(o.label, workCounts[o.value]) }))
  const regions = remoteRegions.filter((r) => r.value !== '')
  return (
    <div className={styles.filters}>
      {/* Phones: the filters sit behind this toggle so the first screen shows search and jobs, not seven fields.
          A real checkbox + label: no JavaScript, keyboard operable. Desktop ignores it and shows everything. */}
      <input id="hero-filters-toggle" type="checkbox" className={styles.toggleInput} />
      <label htmlFor="hero-filters-toggle" className={styles.toggleButton}>
        <span>Filters</span>
        <span className={styles.toggleHint}>role, location, work type, salary</span>
      </label>
      <div className={styles.panel}>
      <div className={styles.selects}>
        <SelectField id="role" name="role" label="Role" allLabel="All roles" options={roles} />
        <LocationField locations={locations} regions={regions} counts={counts} />
      </div>
      <div className={styles.pillGroups}>
        <FilterPills legend="Work arrangement" name="remoteMode" options={work} defaultValue="" />
        <FilterPills legend="Minimum salary" name="minSalary" options={SALARY} defaultValue="100000" />
      </div>
      </div>
    </div>
  )
}
