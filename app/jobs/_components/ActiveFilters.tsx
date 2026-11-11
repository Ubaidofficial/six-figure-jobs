'use client'

import { CountryFlag } from '@/components/ui/CountryFlag'
import { FILTER_PARAMS, activeFilterChips } from '@/lib/jobs/activeFilters'

import { useListingNavigation } from './useListingNavigation'
import styles from './ActiveFilters.module.css'

/**
 * The bar above the results: how many jobs match, each active filter as a chip that removes it, and "Clear all".
 * `pinned` names parameters the page fixes itself (a country page's country), which get no chip.
 */
export function ActiveFilters({ total, pinned = [] }: { total: number; pinned?: string[] }) {
  const { update, searchParams } = useListingNavigation()
  const chips = activeFilterChips(searchParams, pinned)
  const word = total === 1 ? 'job' : 'jobs'

  return (
    <div className={styles.bar}>
      <p className={styles.count} aria-live="polite">
        Showing <strong>{total.toLocaleString()}</strong> {word}
      </p>
      {chips.length > 0 ? (
        <ul className={styles.chips} aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                className={styles.chip}
                aria-label={`Remove filter: ${chip.label}`}
                onClick={() =>
                  update((next) => {
                    if (chip.value === undefined) {
                      next.delete(chip.param)
                      if (chip.param === 'q') next.delete('exact')
                      return
                    }
                    const rest = next
                      .getAll(chip.param)
                      .flatMap((v) => v.split(','))
                      .map((v) => v.trim())
                      .filter((v) => v && v !== chip.value)
                    next.delete(chip.param)
                    for (const v of rest) next.append(chip.param, v)
                  })
                }
              >
                {chip.countryCode ? <CountryFlag code={chip.countryCode} className="mr-1" /> : null}
                {chip.label}
                <span className={styles.x} aria-hidden="true">
                  ×
                </span>
              </button>
            </li>
          ))}
          {chips.length > 1 ? (
            <li>
              <button
                type="button"
                className={styles.clear}
                onClick={() =>
                  update((next) => {
                    for (const p of FILTER_PARAMS) if (!pinned.includes(p)) next.delete(p)
                  })
                }
              >
                Clear all
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
