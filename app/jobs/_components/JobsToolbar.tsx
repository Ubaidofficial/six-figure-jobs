'use client'

import * as React from 'react'

import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { FILTER_PARAMS, activeFilterChips } from '@/lib/jobs/activeFilters'

import { JobsFiltersPanel, type JobsFacets, type LocationPreset, type RolePreset } from './JobsFilters'
import { useListingNavigation } from './useListingNavigation'
import styles from './JobsToolbar.module.css'
import filterStyles from './JobsFilters.module.css'

export function JobsToolbar({
  facets,
  total,
  salaryPresetLabel,
  locationPreset,
  hideSalaryFilter,
  rolePreset,
  hideRoleFilter,
}: {
  facets: JobsFacets
  /** Jobs matching the current filters: the phone sheet's "Show N jobs" button. */
  total?: number
  salaryPresetLabel?: string
  locationPreset?: LocationPreset
  hideSalaryFilter?: boolean
  rolePreset?: RolePreset
  hideRoleFilter?: boolean
}) {
  const navigation = useListingNavigation()
  const { pending, update, searchParams } = navigation

  // A keyword search is ranked by relevance unless the visitor picked another order.
  const sort = searchParams.get('sort') || (searchParams.get('q') ? 'relevant' : 'recent')
  const pinned = [...(locationPreset ? ['country'] : []), ...(salaryPresetLabel ? ['minSalary'] : [])]
  const activeCount = activeFilterChips(searchParams, [...pinned, 'q']).length
  const showLabel =
    typeof total === 'number' ? `Show ${total.toLocaleString()} ${total === 1 ? 'job' : 'jobs'}` : 'Show jobs'

  return (
    <div className={styles.toolbar}>
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="secondary" size="sm" className={styles.mobileOnly}>
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
        </SheetTrigger>
        {/* Each tap updates the list behind the sheet; the footer says how many jobs match and closes the sheet. */}
        <SheetContent side="bottom" className={filterStyles.drawerContent}>
          <SheetHeader>
            <SheetTitle className="text-foreground">Filters</SheetTitle>
          </SheetHeader>
          <div className={filterStyles.drawerBody}>
            <JobsFiltersPanel
              facets={facets}
              salaryPresetLabel={salaryPresetLabel}
              locationPreset={locationPreset}
              hideSalaryFilter={hideSalaryFilter}
              rolePreset={rolePreset}
              hideRoleFilter={hideRoleFilter}
              inSheet
              navigation={navigation}
            />
          </div>
          <div className={filterStyles.drawerFooter}>
            {activeCount > 0 ? (
              <button
                type="button"
                className={filterStyles.drawerClear}
                onClick={() =>
                  update((next) => {
                    for (const p of FILTER_PARAMS) if (p !== 'q' && p !== 'exact') next.delete(p)
                  })
                }
              >
                Clear all
              </button>
            ) : null}
            <SheetClose asChild>
              <button type="button" className={filterStyles.drawerShow} aria-busy={pending}>
                {pending ? 'Updating…' : showLabel}
              </button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      <select
        className={styles.select}
        aria-label="Sort jobs"
        value={sort}
        onChange={(e) => update((next) => next.set('sort', e.target.value))}
      >
        <option value="recent">Most Recent</option>
        <option value="salary">Highest Salary</option>
        <option value="relevant">Most Relevant</option>
      </select>
    </div>
  )
}
