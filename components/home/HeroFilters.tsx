// components/home/HeroFilters.tsx
// Homepage search filters. Few-option fields (work arrangement, minimum salary) are pill toggles built from native
// radio inputs, so they submit with the form and work without JavaScript. Long lists (role, location, remote region)
// stay native <select>s, which keeps the phone pickers and screen-reader behaviour, with one consistent style.

import styles from './HeroFilters.module.css'

type Option = { value: string; label: string }

type HeroFiltersProps = {
  roles: Option[]
  locations: Option[]
  /** Remote regions ("global" = anywhere in the world), offered at the top of the Location list. */
  remoteRegions: Option[]
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

function Pills({
  legend,
  name,
  options,
  defaultValue,
}: {
  legend: string
  name: string
  options: Option[]
  defaultValue: string
}) {
  return (
    <fieldset className={styles.pills}>
      <legend className={styles.label}>{legend}</legend>
      <div className={styles.pillRow}>
        {options.map((o) => (
          <label key={o.value || 'any'} className={styles.pill}>
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={o.value === defaultValue}
              className={styles.pillInput}
            />
            <span className={styles.pillText}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * One Location list: remote regions first ("Anywhere in the world" at the top), then countries (ISO codes). Both submit as `country`;
 * /jobs reads a region slug there as a remote region. Replaced a separate "Remote region" select (2026-11-10): asked for
 * the worldwide option in Location, where people look for it.
 */
function LocationField({ locations, regions }: { locations: Option[]; regions: Option[] }) {
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
                {r.value === 'global' ? '🌍 Anywhere in the world (remote)' : `Remote · ${r.label}`}
              </option>
            ))}
          </optgroup>
          <optgroup label="Country">
            {locations.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  )
}

export function HeroFilters({ roles, locations, remoteRegions }: HeroFiltersProps) {
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
        <LocationField locations={locations} regions={regions} />
      </div>
      <div className={styles.pillGroups}>
        <Pills legend="Work arrangement" name="remoteMode" options={WORK} defaultValue="" />
        <Pills legend="Minimum salary" name="minSalary" options={SALARY} defaultValue="100000" />
      </div>
      </div>
    </div>
  )
}
