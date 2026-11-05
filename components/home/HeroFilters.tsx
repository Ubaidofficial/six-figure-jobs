// components/home/HeroFilters.tsx
// Homepage search filters. Few-option fields (work arrangement, minimum salary) are pill toggles built from native
// radio inputs, so they submit with the form and work without JavaScript. Long lists (role, location, remote region)
// stay native <select>s, which keeps the phone pickers and screen-reader behaviour, with one consistent style.

import styles from './HeroFilters.module.css'

type Option = { value: string; label: string }

type HeroFiltersProps = {
  roles: Option[]
  locations: Option[]
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

export function HeroFilters({ roles, locations, remoteRegions }: HeroFiltersProps) {
  // The first remote-region entry is the "any" option with an empty value; the select renders its own.
  const regions = remoteRegions.filter((r) => r.value !== '')
  return (
    <div className={styles.filters}>
      <div className={styles.selects}>
        <SelectField id="role" name="role" label="Role" allLabel="All roles" options={roles} />
        <SelectField id="country" name="country" label="Location" allLabel="All locations" options={locations} />
        <SelectField
          id="remoteRegion"
          name="remoteRegion"
          label="Remote region"
          allLabel="Any remote region"
          options={regions}
        />
      </div>
      <div className={styles.pillGroups}>
        <Pills legend="Work arrangement" name="remoteMode" options={WORK} defaultValue="" />
        <Pills legend="Minimum salary" name="minSalary" options={SALARY} defaultValue="100000" />
      </div>
    </div>
  )
}
