// app/search/SearchForm.tsx
// The /search form. A plain GET form (same field names as before: q, location, remoteMode, minSalary, remoteRegion,
// seniority). The search box and button are always visible; the five selects sit in a <details> named "Filters",
// which works without JavaScript: closed on phones (it shows how many filters are active), always open on desktop
// (see SearchForm.module.css). Closed or not, the selects are still submitted with the form.

import Link from 'next/link'

import styles from './SearchForm.module.css'

type Option = { value: string; label: string }

const LOCATIONS: Option[] = [
  { value: '', label: 'All locations' },
  { value: 'remote', label: 'Remote only' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'DE', label: 'Germany' },
  { value: 'IE', label: 'Ireland' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AU', label: 'Australia' },
  { value: 'NZ', label: 'New Zealand' },
]

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

const REGIONS: Option[] = [
  { value: '', label: 'Any' },
  { value: 'global', label: 'Global' },
  { value: 'us-only', label: 'US only' },
  { value: 'canada', label: 'Canada' },
  { value: 'emea', label: 'EMEA' },
  { value: 'apac', label: 'APAC' },
  { value: 'uk-ireland', label: 'UK & Ireland' },
]

const SENIORITY: Option[] = [
  { value: '', label: 'Any' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'staff', label: 'Staff' },
  { value: 'principal', label: 'Principal' },
  { value: 'director', label: 'Director' },
  { value: 'vp', label: 'VP' },
  { value: 'c-level', label: 'C-level' },
]

function Select({
  id,
  label,
  options,
  value,
}: {
  id: string
  label: string
  options: Option[]
  value: string | number
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.selectWrap}>
        <select id={id} name={id} defaultValue={value} className={styles.select}>
          {options.map((o) => (
            <option key={o.value || 'any'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function SearchForm({
  q,
  hasRole,
  location,
  remoteMode,
  minSalary,
  remoteRegion,
  seniority,
}: {
  q: string
  hasRole: boolean
  location: string
  remoteMode: string
  minSalary: number
  remoteRegion: string
  seniority: string
}) {
  // The filters that are set to something other than their "any" choice, as the selects below show them.
  const activeCount = [location, remoteMode, remoteRegion, seniority].filter(Boolean).length + (minSalary > 100000 ? 1 : 0)

  return (
    <form action="/search" method="GET" className={styles.form}>
      <div className={styles.searchRow}>
        <div className={styles.queryField}>
          <label htmlFor="q" className={styles.label}>
            Find your next six-figure job
          </label>
          <input
            type="text"
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Role, company, or skill…"
            className={styles.input}
          />
        </div>
        <button type="submit" className={styles.submit}>
          Find $100k+ roles
        </button>
      </div>

      <details className={styles.filters}>
        <summary className={styles.summary}>
          <span className={styles.summaryTitle}>Filters</span>
          <span className={activeCount > 0 ? styles.summaryCount : styles.summaryHint}>
            {activeCount > 0 ? `${activeCount} active` : 'location, work type, salary'}
          </span>
        </summary>
        <div className={styles.panel}>
          <Select id="location" label="Location" options={LOCATIONS} value={location} />
          <Select id="remoteMode" label="Work arrangement" options={WORK} value={remoteMode} />
          <Select id="minSalary" label="Minimum salary" options={SALARY} value={minSalary} />
          <Select id="remoteRegion" label="Remote region" options={REGIONS} value={remoteRegion} />
          <Select id="seniority" label="Seniority" options={SENIORITY} value={seniority} />
        </div>
      </details>

      {(q || hasRole || activeCount > 0) && (
        <Link href="/search" className={styles.clear}>
          Clear filters
        </Link>
      )}
    </form>
  )
}
