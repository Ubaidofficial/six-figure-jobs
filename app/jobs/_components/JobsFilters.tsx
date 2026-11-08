'use client'

import * as React from 'react'
import { ReadonlyURLSearchParams } from 'next/navigation';
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { CountryFlag } from '@/components/ui/CountryFlag'
import { COMPANY_SIZE_BUCKETS, SENIORITY_LEVELS, type HubExtraFacets } from '@/lib/jobs/hubFilters'
import { remoteRegionDef } from '@/lib/jobs/remoteRegions'
import { countryName } from '@/lib/location/country'

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
} & HubExtraFacets

export type LocationPreset = {
  label: string
  /** ISO code, for the flag. */
  countryCode?: string
}

export type RolePreset = {
  label: string
  emoji?: string
}

function prettySlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

type SearchParamsLike = { getAll: (key: string) => string[] }

function parseMulti(sp: SearchParamsLike, key: string): string[] {
  const values = sp.getAll(key).flatMap((v) => v.split(','))
  const normalized = values.map((v) => v.trim()).filter(Boolean)
  return Array.from(new Set(normalized))
}

function replaceSearchParams(
  pathname: string,
  searchParams: any,
  router: ReturnType<typeof useRouter>,
  updater: (next: URLSearchParams) => void
) {
  const next = new URLSearchParams(searchParams.toString())
  updater(next)
  if (next.get('page') === '1') next.delete('page')
  const qs = next.toString()
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
}

type OptionItem = { value: string; label: string; count?: number }

/** A checkbox-style list of choices; `onToggle` gets the value that was clicked. */
function OptionList({
  items,
  isActive,
  onToggle,
  label,
}: {
  items: OptionItem[]
  isActive: (value: string) => boolean
  onToggle: (value: string) => void
  label: string
}) {
  return (
    <div className={styles.list} role="group" aria-label={label}>
      {items.map((item) => {
        const active = isActive(item.value)
        return (
          <button
            key={item.value}
            type="button"
            className={styles.option}
            aria-pressed={active}
            onClick={() => onToggle(item.value)}
          >
            <span className={styles.left}>
              <span className={`${styles.check} ${active ? styles.checked : ''}`}>
                {active ? <span className={styles.checkMark}>✓</span> : null}
              </span>
              <span className={styles.name}>{item.label}</span>
            </span>
            <span className={styles.count}>{typeof item.count === 'number' ? item.count.toLocaleString() : null}</span>
          </button>
        )
      })}
    </div>
  )
}

export function JobsFiltersPanel({
  facets,
  salaryPresetLabel,
  locationPreset,
  hideSalaryFilter,
  rolePreset,
  hideRoleFilter,
}: {
  facets: JobsFacets
  salaryPresetLabel?: string
  locationPreset?: LocationPreset
  hideSalaryFilter?: boolean
  rolePreset?: RolePreset
  hideRoleFilter?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [locationQuery, setLocationQuery] = React.useState('')
  const [roleQuery, setRoleQuery] = React.useState('')
  const [cityQuery, setCityQuery] = React.useState('')

  const selectedCountry = searchParams.get('country') || ''
  const selectedRemoteMode = searchParams.get('remoteMode') || ''
  const selectedRoles = React.useMemo(
    () => parseMulti(searchParams, 'role'),
    [searchParams]
  )
  const selectedSeniority = React.useMemo(
    () => parseMulti(searchParams, 'seniority'),
    [searchParams]
  )
  const selectedCompanySizes = React.useMemo(
    () => parseMulti(searchParams, 'companySize'),
    [searchParams]
  )
  const selectedRegion = searchParams.get('remoteRegion') || ''
  const selectedCity = searchParams.get('city') || ''

  const minSalary = (() => {
    const raw = searchParams.get('minSalary') || ''
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return 100_000
    return Math.min(Math.max(100_000, Math.round(n / 1000) * 1000), 450_000)
  })()

  const filteredCountries = React.useMemo(() => {
    const q = locationQuery.trim().toLowerCase()
    if (!q) return facets.countries
    return facets.countries.filter((c) => {
      const code = c.value.toUpperCase()
      const label = countryName(code) ?? code
      return `${label} ${code}`.toLowerCase().includes(q)
    })
  }, [facets.countries, locationQuery])

  const filteredCities = React.useMemo(() => {
    const q = cityQuery.trim().toLowerCase()
    const cities = facets.cities ?? []
    return q ? cities.filter((c) => c.label.toLowerCase().includes(q)) : cities
  }, [facets.cities, cityQuery])

  const filteredRoles = React.useMemo(() => {
    const q = roleQuery.trim().toLowerCase()
    if (!q) return facets.roles
    return facets.roles.filter((r) => r.value.toLowerCase().includes(q))
  }, [facets.roles, roleQuery])

  const clearAll = React.useCallback(() => {
    replaceSearchParams(pathname, searchParams, router, (next) => {
      next.delete('country')
      next.delete('remoteMode')
      next.delete('role')
      next.delete('skill')
      next.delete('seniority')
      next.delete('companySize')
      next.delete('minSalary')
      next.delete('remoteRegion')
      next.delete('city')
      next.delete('tech')
      next.delete('visa')
      next.delete('page')
    })
  }, [pathname, router, searchParams])

  // Toggles one value of a multi-value filter (`?seniority=senior&seniority=lead`).
  const toggleMulti = (key: string, current: string[], value: string) =>
    replaceSearchParams(pathname, searchParams, router, (next) => {
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
      next.delete(key)
      for (const v of updated) next.append(key, v)
      next.delete('page')
    })

  // Sets a single-value filter, or clears it when the chosen value is already active.
  const toggleSingle = (key: string, current: string, value: string) =>
    replaceSearchParams(pathname, searchParams, router, (next) => {
      if (current === value) next.delete(key)
      else next.set(key, value)
      next.delete('page')
    })

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>Filters</div>
        <button type="button" className={styles.clearAll} onClick={clearAll}>
          Clear all
        </button>
      </div>

      <div className={styles.sections}>
        {!hideSalaryFilter ? (
          <details className={styles.section} open>
            <summary className={styles.summary}>
              Salary Range <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.content}>
              {salaryPresetLabel ? (
                <>
                  <div className={styles.controlRow}>
                    <div className={styles.label}>Salary</div>
                    <div className={styles.value}>{salaryPresetLabel}</div>
                  </div>
                  <div className={styles.help}>
                    This page is pre-filtered to this salary range (USD).
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.controlRow}>
                    <div className={styles.label}>Minimum salary</div>
                    <div className={styles.value}>${Math.round(minSalary / 1000)}k+</div>
                  </div>
                  <input
                    className={styles.range}
                    type="range"
                    min={100_000}
                    max={450_000}
                    step={5_000}
                    value={minSalary}
                    aria-label="Minimum salary"
                    onChange={(e) => {
                      const value = Number(e.target.value) || 100_000
                      replaceSearchParams(pathname, searchParams, router, (next) => {
                        next.set('minSalary', String(value))
                        next.delete('page')
                      })
                    }}
                  />
                  <div className={styles.help}>
                    Salary filtering is most accurate when a country is selected.
                  </div>
                </>
              )}
            </div>
          </details>
        ) : null}

        <details className={styles.section} open>
          <summary className={styles.summary}>
            Location <span className={styles.chev}>⌄</span>
          </summary>
          <div className={styles.content}>
            {locationPreset ? (
              <>
                <div className={styles.controlRow}>
                  <div className={styles.label}>Country</div>
                  <div className={styles.value}>
                    <CountryFlag code={locationPreset.countryCode} className="mr-1.5" />
                    {locationPreset.label}
                  </div>
                </div>
                <div className={styles.help}>This page is pinned to this location.</div>
              </>
            ) : (
              <>
                <input
                  className={styles.textInput}
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Search countries…"
                  aria-label="Search countries"
                />
                <div className={styles.list} role="group">
                  {filteredCountries.map((c) => {
                    const active = selectedCountry.toUpperCase() === c.value.toUpperCase()
                    const code = c.value.toUpperCase()
                    const label = countryName(code) ?? code
                    return (
                      <button
                        key={c.value}
                        type="button"
                        className={styles.option}
                        onClick={() => {
                          replaceSearchParams(pathname, searchParams, router, (next) => {
                            if (active) next.delete('country')
                            else next.set('country', c.value.toUpperCase())
                            next.delete('page')
                          })
                        }}
                      >
                        <span className={styles.left}>
                          <span className={`${styles.check} ${active ? styles.checked : ''}`}>
                            {active ? <span className={styles.checkMark}>✓</span> : null}
                          </span>
                          <span className={styles.name}>
                            <CountryFlag code={code} className="mr-1.5" />
                            {label}
                          </span>
                        </span>
                        <span className={styles.count}>{c.count.toLocaleString()}</span>
                      </button>
                    )
                  })}
                </div>
                {facets.cities && facets.cities.length > 0 ? (
                  <>
                    <div className={styles.label} style={{ marginTop: 12 }}>
                      City
                    </div>
                    <input
                      className={styles.textInput}
                      value={cityQuery}
                      onChange={(e) => setCityQuery(e.target.value)}
                      placeholder="Search cities…"
                      aria-label="Search cities"
                    />
                    <OptionList
                      label="City"
                      items={filteredCities}
                      isActive={(v) => selectedCity === v}
                      onToggle={(v) => toggleSingle('city', selectedCity, v)}
                    />
                  </>
                ) : null}
              </>
            )}
          </div>
        </details>

        <details className={styles.section} open>
          <summary className={styles.summary}>
            Work Type <span className={styles.chev}>⌄</span>
          </summary>
          <div className={styles.content}>
            <div className={styles.radios} role="radiogroup" aria-label="Work type">
              {(
                [
                  { value: '', label: 'Any', count: null },
                  { value: 'remote', label: 'Remote', count: facets.workTypes.remote },
                  { value: 'hybrid', label: 'Hybrid', count: facets.workTypes.hybrid },
                  { value: 'onsite', label: 'Onsite', count: facets.workTypes.onsite },
                ] as const
              ).map((opt) => {
                const active = selectedRemoteMode === opt.value
                return (
                  <button
                    key={opt.value || 'any'}
                    type="button"
                    className={styles.radio}
                    onClick={() => {
                      replaceSearchParams(pathname, searchParams, router, (next) => {
                        if (!opt.value) next.delete('remoteMode')
                        else next.set('remoteMode', opt.value)
                        next.delete('page')
                      })
                    }}
                  >
                    <span className={styles.radioLeft}>
                      <span className={`${styles.dot} ${active ? styles.dotOn : ''}`} />
                      <span className={styles.name}>{opt.label}</span>
                    </span>
                    {typeof opt.count === 'number' ? (
                      <span className={styles.count}>{opt.count.toLocaleString()}</span>
                    ) : (
                      <span className={styles.count} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </details>

        {facets.remoteRegions && (facets.remoteRegions.length > 0 || selectedRegion) ? (
          <details className={styles.section} open>
            <summary className={styles.summary}>
              Remote Region <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.content}>
              <OptionList
                label="Remote region"
                items={facets.remoteRegions.map((r) => ({
                  value: r.value,
                  label: remoteRegionDef(r.value)?.label ?? r.value,
                  count: r.count,
                }))}
                isActive={(v) => selectedRegion === v}
                onToggle={(v) => toggleSingle('remoteRegion', selectedRegion, v)}
              />
              <div className={styles.help}>Remote jobs open to people in that region.</div>
            </div>
          </details>
        ) : null}

        {!hideRoleFilter ? (
          <details className={styles.section} open>
            <summary className={styles.summary}>
              Role <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.content}>
              {rolePreset ? (
                <>
                  <div className={styles.controlRow}>
                    <div className={styles.label}>Role</div>
                    <div className={styles.value}>
                      {rolePreset.emoji ? `${rolePreset.emoji} ` : ''}
                      {rolePreset.label}
                    </div>
                  </div>
                  <div className={styles.help}>This page is pinned to this role.</div>
                </>
              ) : (
                <>
                  <input
                    className={styles.textInput}
                    value={roleQuery}
                    onChange={(e) => setRoleQuery(e.target.value)}
                    placeholder="Search roles…"
                    aria-label="Search roles"
                  />
                  <div className={styles.list} role="group">
                    {filteredRoles.map((r) => {
                      const active = selectedRoles.includes(r.value)
                      return (
                        <button
                          key={r.value}
                          type="button"
                          className={styles.option}
                          onClick={() => {
                            replaceSearchParams(pathname, searchParams, router, (next) => {
                              const current = parseMulti(next, 'role')
                              const updated = active
                                ? current.filter((v) => v !== r.value)
                                : [...current, r.value]
                              next.delete('role')
                              for (const v of updated) next.append('role', v)
                              next.delete('page')
                            })
                          }}
                        >
                          <span className={styles.left}>
                            <span className={`${styles.check} ${active ? styles.checked : ''}`}>
                              {active ? <span className={styles.checkMark}>✓</span> : null}
                            </span>
                            <span className={styles.name}>{prettySlug(r.value)}</span>
                          </span>
                          <span className={styles.count}>{r.count.toLocaleString()}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </details>
        ) : null}

        <details className={styles.section} open>
          <summary className={styles.summary}>
            Seniority <span className={styles.chev}>⌄</span>
          </summary>
          <div className={styles.content}>
            <OptionList
              label="Seniority"
              items={SENIORITY_LEVELS.flatMap((l) => {
                const found = facets.seniorities?.find((s) => s.value === l.value)
                // With counts from the page, only levels that have jobs; without (role and salary pages), all of them.
                return facets.seniorities && !found ? [] : [{ value: l.value, label: l.label, count: found?.count }]
              })}
              isActive={(v) => selectedSeniority.includes(v)}
              onToggle={(v) => toggleMulti('seniority', selectedSeniority, v)}
            />
            <div className={styles.help}>Read from the job title, so jobs without a level word are not listed here.</div>
          </div>
        </details>

        {facets.companySizes && facets.companySizes.length > 0 ? (
          <details className={styles.section} open>
            <summary className={styles.summary}>
              Company Size <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.content}>
              <OptionList
                label="Company size"
                items={COMPANY_SIZE_BUCKETS.filter((b) => facets.companySizes?.includes(b.value)).map((b) => ({
                  value: b.value,
                  label: `${b.label} employees`,
                }))}
                isActive={(v) => selectedCompanySizes.includes(v)}
                onToggle={(v) => toggleMulti('companySize', selectedCompanySizes, v)}
              />
            </div>
          </details>
        ) : null}

        {facets.techs && facets.techs.length > 0 ? (
          <details className={styles.section} open>
            <summary className={styles.summary}>
              Technology <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.content}>
              <div className={styles.list} role="group" aria-label="Technology">
                {facets.techs.map((t) => {
                  const active = (searchParams.get('tech') || '').toLowerCase() === t.value.toLowerCase()
                  return (
                    <button
                      key={t.value}
                      type="button"
                      className={styles.option}
                      aria-pressed={active}
                      onClick={() => {
                        replaceSearchParams(pathname, searchParams, router, (next) => {
                          if (active) next.delete('tech')
                          else next.set('tech', t.value)
                          next.delete('page')
                        })
                      }}
                    >
                      <span className={styles.left}>
                        <span className={`${styles.check} ${active ? styles.checked : ''}`}>
                          {active ? <span className={styles.checkMark}>✓</span> : null}
                        </span>
                        <span className={styles.name}>{t.value}</span>
                      </span>
                      <span className={styles.count}>{t.count.toLocaleString()}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </details>
        ) : null}

        {facets.visaFilter ? (
          <details className={styles.section} open>
            <summary className={styles.summary}>
              Visa <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.content}>
              <div className={styles.list} role="group" aria-label="Visa">
                {(() => {
                  const active = searchParams.get('visa') === '1'
                  return (
                    <button
                      type="button"
                      className={styles.option}
                      aria-pressed={active}
                      onClick={() => {
                        replaceSearchParams(pathname, searchParams, router, (next) => {
                          if (active) next.delete('visa')
                          else next.set('visa', '1')
                          next.delete('page')
                        })
                      }}
                    >
                      <span className={styles.left}>
                        <span className={`${styles.check} ${active ? styles.checked : ''}`}>
                          {active ? <span className={styles.checkMark}>✓</span> : null}
                        </span>
                        <span className={styles.name}>Offers visa sponsorship</span>
                      </span>
                      <span className={styles.count} />
                    </button>
                  )
                })()}
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  )
}
