'use client'

import * as React from 'react'

import { RegionMark } from '@/components/ui/RegionMark'
import { remoteRegionDef } from '@/lib/jobs/remoteRegions'
import { CountryFlag } from '@/components/ui/CountryFlag'
import { countryName } from '@/lib/location/country'
import { FILTER_PARAMS, multiParam, prettySlug } from '@/lib/jobs/activeFilters'
import { SALARY_FILTER_STEPS, salaryFilterCurrency, salaryFilterLabel } from '@/lib/jobs/salaryFilter'

import { useListingNavigation } from './useListingNavigation'
import styles from './JobsFilters.module.css'

export type JobsFacetItem = { value: string; count: number }

export type JobsFacets = {
  roles: JobsFacetItem[]
  countries: JobsFacetItem[]
  workTypes: { remote: number; hybrid: number; onsite: number }
  /** Most common skills in current jobs. When present, the panel shows a Technology filter. */
  techs?: JobsFacetItem[]
  /** When true, the panel shows the Visa sponsorship toggle (the page must apply the `visa` param). */
  visaFilter?: boolean
  /** Remote jobs per region ("global" = can be done from anywhere). When present, the panel shows a Remote region filter. */
  remoteRegions?: Array<{ value: string; label: string; count: number }>
  /** Jobs per seniority level and company size with the other filters on (lib/jobs/levelSizeFacets.ts). */
  seniority?: Record<string, number>
  companySizes?: Record<string, number>
}

export type LocationPreset = {
  label: string
  /** ISO code, for the flag. */
  countryCode?: string
}

export type RolePreset = {
  label: string
  emoji?: string
}

/** Long lists show this many options until "Show all" is pressed. */
const SHORT_LIST = 6

const SENIORITY = [
  { value: 'mid', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' },
  { value: 'staff', label: 'Staff' },
  { value: 'principal', label: 'Principal' },
  { value: 'lead', label: 'Lead' },
] as const

const COMPANY_SIZES = [
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1,000' },
  { value: '1000+', label: '1,000+' },
] as const

type Navigation = ReturnType<typeof useListingNavigation>

/**
 * One group of filters. Sections people use most start open; the rest start closed unless one of their filters is on,
 * so the panel is short enough to read at a glance (it was nine open sections, about 2,500px tall).
 */
function Section({ title, open, children }: { title: string; open: boolean; children: React.ReactNode }) {
  return (
    <details className={styles.section} open={open}>
      <summary className={styles.summary}>
        {title} <span className={styles.chev} aria-hidden="true" />
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  )
}

/** A pill that toggles (aria-pressed), the same look as the homepage and /search filters. */
function Pill({
  on,
  onClick,
  children,
  count,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number | null
}) {
  // An option that would show nothing is disabled (unless it is on, so it can be turned off).
  const empty = count === 0 && !on
  return (
    <button
      type="button"
      className={`${styles.pill} ${on ? styles.pillOn : ''}`}
      aria-pressed={on}
      onClick={onClick}
      disabled={empty}
    >
      <span>{children}</span>
      {typeof count === 'number' ? <span className={styles.pillCount}>{count.toLocaleString()}</span> : null}
    </button>
  )
}

/** A checklist row (several can be on). */
function Option({
  on,
  onClick,
  children,
  count,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
}) {
  return (
    <button type="button" className={`${styles.option} ${on ? styles.optionOn : ''}`} aria-pressed={on} onClick={onClick}>
      <span className={styles.left}>
        <span className={`${styles.check} ${on ? styles.checked : ''}`} aria-hidden="true">
          {on ? <span className={styles.checkMark}>✓</span> : null}
        </span>
        <span className={styles.name}>{children}</span>
      </span>
      {typeof count === 'number' ? <span className={styles.count}>{count.toLocaleString()}</span> : null}
    </button>
  )
}

/**
 * A long list: the first SHORT_LIST options (always including the ones that are on), then "Show all N". A search box
 * appears once the list is open, when there are many options.
 */
function ShortList<T>({
  items,
  isOn,
  render,
  searchLabel,
  matches,
}: {
  items: T[]
  isOn: (item: T) => boolean
  render: (item: T) => React.ReactNode
  searchLabel: string
  matches: (item: T, query: string) => boolean
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const q = query.trim().toLowerCase()

  const shown = expanded
    ? items.filter((item) => !q || matches(item, q))
    : items.filter((item, i) => i < SHORT_LIST || isOn(item))

  return (
    <>
      {expanded && items.length > 12 ? (
        <input
          className={styles.textInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${searchLabel}…`}
          aria-label={searchLabel}
        />
      ) : null}
      <div className={styles.list} role="group">
        {shown.map(render)}
      </div>
      {items.length > SHORT_LIST ? (
        <button type="button" className={styles.more} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      ) : null}
    </>
  )
}

export function JobsFiltersPanel({
  facets,
  salaryPresetLabel,
  locationPreset,
  hideSalaryFilter,
  rolePreset,
  hideRoleFilter,
  inSheet,
  navigation,
}: {
  facets: JobsFacets
  salaryPresetLabel?: string
  locationPreset?: LocationPreset
  hideSalaryFilter?: boolean
  rolePreset?: RolePreset
  hideRoleFilter?: boolean
  /** In the phone sheet, which has its own title and footer: no panel header or frame. */
  inSheet?: boolean
  /** Shared with the sheet's footer, so its button can show that results are updating. */
  navigation?: Navigation
}) {
  const own = useListingNavigation()
  const { update, searchParams } = navigation ?? own

  const selectedCountry = (searchParams.get('country') || '').toUpperCase()
  const selectedRemoteMode = searchParams.get('remoteMode') || ''
  const selectedRemoteRegion = (searchParams.get('remoteRegion') || '').toLowerCase()
  const selectedRoles = multiParam(searchParams, 'role')
  const selectedSeniority = multiParam(searchParams, 'seniority')
  const selectedCompanySizes = multiParam(searchParams, 'companySize')
  const selectedTech = (searchParams.get('tech') || '').toLowerCase()
  const visaOn = searchParams.get('visa') === '1'
  const minSalary = Number(searchParams.get('minSalary') || '') || 0
  const currency = salaryFilterCurrency(locationPreset?.countryCode || selectedCountry)

  const anyActive = FILTER_PARAMS.some((p) => p !== 'q' && p !== 'exact' && searchParams.has(p))

  const set = (key: string, value: string | null) =>
    update((next) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })

  const toggleMulti = (key: string, value: string, on: boolean) =>
    update((next) => {
      const current = multiParam(next, key)
      const updated = on ? current.filter((v) => v !== value) : [...current, value]
      next.delete(key)
      for (const v of updated) next.append(key, v)
    })

  // A region means remote work; a hybrid or on-site choice would leave nothing to show.
  const setRegion = (value: string | null, clearCountry = false) =>
    update((next) => {
      if (value) next.set('remoteRegion', value)
      else next.delete('remoteRegion')
      if (value && next.get('remoteMode') !== 'remote') next.delete('remoteMode')
      if (clearCountry) next.delete('country')
    })

  const clearAll = () =>
    update((next) => {
      for (const p of FILTER_PARAMS) if (p !== 'q' && p !== 'exact') next.delete(p)
    })

  const worldwide = facets.remoteRegions?.find((r) => r.value === 'global')
  const regions = (facets.remoteRegions ?? []).filter((r) => r.count > 0 || r.value === selectedRemoteRegion)

  return (
    <div className={inSheet ? styles.panelBare : styles.panel}>
      {inSheet ? null : (
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Filters</h2>
          {anyActive ? (
            <button type="button" className={styles.clearAll} onClick={clearAll}>
              Clear all
            </button>
          ) : null}
        </div>
      )}

      <div className={styles.sections}>
        {!hideSalaryFilter ? (
          <Section title="Salary" open>
            {salaryPresetLabel ? (
              <p className={styles.pinned}>{salaryPresetLabel} (this page)</p>
            ) : (
              <>
                <div className={styles.pills} role="group" aria-label="Minimum salary">
                  <Pill on={minSalary <= 100_000} onClick={() => set('minSalary', null)}>
                    Any
                  </Pill>
                  {SALARY_FILTER_STEPS.map((amount) => (
                    <Pill key={amount} on={minSalary === amount} onClick={() => set('minSalary', String(amount))}>
                      {salaryFilterLabel(amount, currency)}
                    </Pill>
                  ))}
                </div>
                {!selectedCountry && !locationPreset ? (
                  <p className={styles.help}>Compares salaries in US dollars. Pick a country to use its currency.</p>
                ) : null}
              </>
            )}
          </Section>
        ) : null}

        <Section title="Work type" open>
          <div className={styles.pills} role="group" aria-label="Work type">
            <Pill on={!selectedRemoteMode} onClick={() => set('remoteMode', null)}>
              Any
            </Pill>
            <Pill on={selectedRemoteMode === 'remote'} onClick={() => set('remoteMode', 'remote')} count={facets.workTypes.remote}>
              Remote
            </Pill>
            <Pill on={selectedRemoteMode === 'hybrid'} onClick={() => set('remoteMode', 'hybrid')} count={facets.workTypes.hybrid}>
              Hybrid
            </Pill>
            <Pill on={selectedRemoteMode === 'onsite'} onClick={() => set('remoteMode', 'onsite')} count={facets.workTypes.onsite}>
              On-site
            </Pill>
          </div>
        </Section>

        <Section title="Location" open>
          {locationPreset ? (
            <p className={styles.pinned}>
              <CountryFlag code={locationPreset.countryCode} className="mr-1.5" />
              {locationPreset.label} (this page)
            </p>
          ) : (
            <>
              {/* "Anywhere in the world" where people look for it: the same filter as Remote region > global. */}
              {worldwide && (worldwide.count > 0 || selectedRemoteRegion === 'global') ? (
                <Option
                  on={selectedRemoteRegion === 'global'}
                  count={worldwide.count}
                  onClick={() => setRegion(selectedRemoteRegion === 'global' ? null : 'global', true)}
                >
                  🌍 Anywhere in the world
                </Option>
              ) : null}
              <ShortList
                items={facets.countries}
                isOn={(c) => c.value.toUpperCase() === selectedCountry}
                searchLabel="Search countries"
                matches={(c, q) => `${countryName(c.value) ?? ''} ${c.value}`.toLowerCase().includes(q)}
                render={(c) => {
                  const code = c.value.toUpperCase()
                  const on = code === selectedCountry
                  return (
                    <Option key={code} on={on} count={c.count} onClick={() => set('country', on ? null : code)}>
                      <CountryFlag code={code} className="mr-1.5" />
                      {countryName(code) ?? code}
                    </Option>
                  )
                }}
              />
            </>
          )}
        </Section>

        {!hideRoleFilter ? (
          <Section title="Role" open>
            {rolePreset ? (
              <p className={styles.pinned}>
                {rolePreset.emoji ? `${rolePreset.emoji} ` : ''}
                {rolePreset.label} (this page)
              </p>
            ) : (
              <ShortList
                items={facets.roles}
                isOn={(r) => selectedRoles.includes(r.value)}
                searchLabel="Search roles"
                matches={(r, q) => r.value.replace(/-/g, ' ').includes(q)}
                render={(r) => {
                  const on = selectedRoles.includes(r.value)
                  return (
                    <Option key={r.value} on={on} count={r.count} onClick={() => toggleMulti('role', r.value, on)}>
                      {prettySlug(r.value)}
                    </Option>
                  )
                }}
              />
            )}
          </Section>
        ) : null}

        <Section title="Seniority" open>
          <div className={styles.pills} role="group" aria-label="Seniority">
            {SENIORITY.map((opt) => {
              const on = selectedSeniority.includes(opt.value)
              return (
                <Pill
                  key={opt.value}
                  on={on}
                  count={facets.seniority ? (facets.seniority[opt.value] ?? 0) : undefined}
                  onClick={() => toggleMulti('seniority', opt.value, on)}
                >
                  {opt.label}
                </Pill>
              )
            })}
          </div>
        </Section>

        {regions.length > 0 ? (
          <Section title="Remote region" open={Boolean(selectedRemoteRegion)}>
            <ShortList
              items={regions}
              isOn={(r) => r.value === selectedRemoteRegion}
              searchLabel="Search regions"
              matches={(r, q) => r.label.toLowerCase().includes(q)}
              render={(r) => {
                const on = r.value === selectedRemoteRegion
                return (
                  <Option key={r.value} on={on} count={r.count} onClick={() => setRegion(on ? null : r.value)}>
                    <RegionMark mark={remoteRegionDef(r.value)?.mark} className="mr-1.5" />
                    {r.label}
                  </Option>
                )
              }}
            />
          </Section>
        ) : null}

        <Section title="Company size" open={selectedCompanySizes.length > 0}>
          <div className={styles.pills} role="group" aria-label="Company size (employees)">
            {COMPANY_SIZES.map((opt) => {
              const on = selectedCompanySizes.includes(opt.value)
              return (
                <Pill
                  key={opt.value}
                  on={on}
                  count={facets.companySizes ? (facets.companySizes[opt.value] ?? 0) : undefined}
                  onClick={() => toggleMulti('companySize', opt.value, on)}
                >
                  {opt.label}
                </Pill>
              )
            })}
          </div>
          <p className={styles.help}>Employees.</p>
        </Section>

        {facets.techs && facets.techs.length > 0 ? (
          <Section title="Technology" open={Boolean(selectedTech)}>
            <ShortList
              items={facets.techs}
              isOn={(t) => t.value.toLowerCase() === selectedTech}
              searchLabel="Search technologies"
              matches={(t, q) => t.value.toLowerCase().includes(q)}
              render={(t) => {
                const on = t.value.toLowerCase() === selectedTech
                return (
                  <Option key={t.value} on={on} count={t.count} onClick={() => set('tech', on ? null : t.value)}>
                    {t.value}
                  </Option>
                )
              }}
            />
          </Section>
        ) : null}

        {facets.visaFilter ? (
          <Section title="Visa" open={visaOn}>
            <Option on={visaOn} onClick={() => set('visa', visaOn ? null : '1')}>
              Offers visa sponsorship
            </Option>
          </Section>
        ) : null}
      </div>
    </div>
  )
}
