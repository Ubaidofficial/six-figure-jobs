'use client'

import * as React from 'react'
import { ReadonlyURLSearchParams } from 'next/navigation';
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import styles from './JobsFilters.module.css'

export type JobsFacetItem = { value: string; count: number }

export type JobsFacets = {
  roles: JobsFacetItem[]
  countries: JobsFacetItem[]
  workTypes: { remote: number; hybrid: number; onsite: number }
}

export type LocationPreset = {
  label: string
  emoji?: string
}

export type RolePreset = {
  label: string
  emoji?: string
}

const COUNTRY_LABELS: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  DE: 'Germany',
  AU: 'Australia',
  NL: 'Netherlands',
  IE: 'Ireland',
  FR: 'France',
  ES: 'Spain',
  SE: 'Sweden',
  CH: 'Switzerland',
  DK: 'Denmark',
  NO: 'Norway',
  FI: 'Finland',
  PL: 'Poland',
  IN: 'India',
  SG: 'Singapore',
  JP: 'Japan',
}

function flagEmojiFromCountryCode(code: string): string {
  const cc = (code || '').toUpperCase()
  if (cc.length !== 2) return ''
  const A = 0x1f1e6
  const base = 'A'.charCodeAt(0)
  const first = A + (cc.charCodeAt(0) - base)
  const second = A + (cc.charCodeAt(1) - base)
  return String.fromCodePoint(first, second)
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
      const label = COUNTRY_LABELS[code] ?? code
      return `${label} ${code}`.toLowerCase().includes(q)
    })
  }, [facets.countries, locationQuery])

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
      next.delete('page')
    })
  }, [pathname, router, searchParams])

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
                    {locationPreset.emoji ? `${locationPreset.emoji} ` : ''}
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
                <div className={styles.list} role="list">
                  {filteredCountries.map((c) => {
                    const active = selectedCountry.toUpperCase() === c.value.toUpperCase()
                    const code = c.value.toUpperCase()
                    const label = COUNTRY_LABELS[code] ?? code
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
                            {flagEmojiFromCountryCode(code)} {label}
                          </span>
                        </span>
                        <span className={styles.count}>{c.count.toLocaleString()}</span>
                      </button>
                    )
                  })}
                </div>
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
                  <div className={styles.list} role="list">
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
            <div className={styles.list} role="list">
              {(
                [
                  { value: 'mid', label: 'Mid-level' },
                  { value: 'senior', label: 'Senior' },
                  { value: 'staff', label: 'Staff' },
                  { value: 'principal', label: 'Principal' },
                  { value: 'lead', label: 'Lead' },
                ] as const
              ).map((opt) => {
                const active = selectedSeniority.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={styles.option}
                    onClick={() => {
                      replaceSearchParams(pathname, searchParams, router, (next) => {
                        const current = parseMulti(next, 'seniority')
                        const updated = active
                          ? current.filter((v) => v !== opt.value)
                          : [...current, opt.value]
                        next.delete('seniority')
                        for (const v of updated) next.append('seniority', v)
                        next.delete('page')
                      })
                    }}
                  >
                    <span className={styles.left}>
                      <span className={`${styles.check} ${active ? styles.checked : ''}`}>
                        {active ? <span className={styles.checkMark}>✓</span> : null}
                      </span>
                      <span className={styles.name}>{opt.label}</span>
                    </span>
                    <span className={styles.count} />
                  </button>
                )
              })}
            </div>
          </div>
        </details>

        <details className={styles.section} open>
          <summary className={styles.summary}>
            Company Size <span className={styles.chev}>⌄</span>
          </summary>
          <div className={styles.content}>
            <div className={styles.list} role="list">
              {(
                [
                  { value: '1-10', label: '1–10' },
                  { value: '11-50', label: '11–50' },
                  { value: '51-200', label: '51–200' },
                  { value: '201-1000', label: '201–1000' },
                  { value: '1000+', label: '1000+' },
                ] as const
              ).map((opt) => {
                const active = selectedCompanySizes.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={styles.option}
                    onClick={() => {
                      replaceSearchParams(pathname, searchParams, router, (next) => {
                        const current = parseMulti(next, 'companySize')
                        const updated = active
                          ? current.filter((v) => v !== opt.value)
                          : [...current, opt.value]
                        next.delete('companySize')
                        for (const v of updated) next.append('companySize', v)
                        next.delete('page')
                      })
                    }}
                  >
                    <span className={styles.left}>
                      <span className={`${styles.check} ${active ? styles.checked : ''}`}>
                        {active ? <span className={styles.checkMark}>✓</span> : null}
                      </span>
                      <span className={styles.name}>{opt.label} employees</span>
                    </span>
                    <span className={styles.count} />
                  </button>
                )
              })}
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}
