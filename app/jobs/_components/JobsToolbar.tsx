'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

import { JobsFiltersPanel, type JobsFacets, type LocationPreset, type RolePreset } from './JobsFilters'
import styles from './JobsToolbar.module.css'
import filterStyles from './JobsFilters.module.css'

function replaceParam(
  pathname: string,
  searchParams: any,
  router: ReturnType<typeof useRouter>,
  key: string,
  value: string | null
) {
  const next = new URLSearchParams(searchParams.toString())
  if (!value) next.delete(key)
  else next.set(key, value)
  if (next.get('page') === '1') next.delete('page')
  const qs = next.toString()
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
}

export function JobsToolbar({
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

  const sort = searchParams.get('sort') || 'recent'
  const view = searchParams.get('view') || 'grid'

  return (
    <div className={styles.toolbar}>
      <Sheet>
        <SheetTrigger asChild>
          <span className={styles.mobileOnly}>
            <Button type="button" variant="secondary" size="sm">
              Filters
            </Button>
          </span>
        </SheetTrigger>
        <SheetContent side="bottom" className={filterStyles.drawerContent}>
          <SheetHeader>
            <SheetTitle className="text-slate-50">Filters</SheetTitle>
          </SheetHeader>
          <div style={{ marginTop: 12 }}>
            <JobsFiltersPanel
              facets={facets}
              salaryPresetLabel={salaryPresetLabel}
              locationPreset={locationPreset}
              hideSalaryFilter={hideSalaryFilter}
              rolePreset={rolePreset}
              hideRoleFilter={hideRoleFilter}
            />
          </div>
        </SheetContent>
      </Sheet>

      <select
        className={styles.select}
        aria-label="Sort jobs"
        value={sort}
        onChange={(e) =>
          replaceParam(pathname, searchParams, router, 'sort', e.target.value)
        }
      >
        <option value="recent">Most Recent</option>
        <option value="salary">Highest Salary</option>
        <option value="relevant">Most Relevant</option>
      </select>

      <div className={styles.segmented} role="group" aria-label="View toggle">
        <button
          type="button"
          className={`${styles.segButton} ${view === 'grid' ? styles.segActive : ''}`}
          onClick={() => replaceParam(pathname, searchParams, router, 'view', 'grid')}
        >
          Grid
        </button>
        <button
          type="button"
          className={`${styles.segButton} ${view === 'list' ? styles.segActive : ''}`}
          onClick={() => replaceParam(pathname, searchParams, router, 'view', 'list')}
        >
          List
        </button>
      </div>
    </div>
  )
}
