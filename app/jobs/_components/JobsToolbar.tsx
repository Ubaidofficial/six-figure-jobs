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
  keywordSearch,
}: {
  facets: JobsFacets
  salaryPresetLabel?: string
  locationPreset?: LocationPreset
  hideSalaryFilter?: boolean
  rolePreset?: RolePreset
  hideRoleFilter?: boolean
  /** Shows the keyword box. Only for a page that applies the `q` param (the /jobs hub). */
  keywordSearch?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // A keyword search is ranked by relevance unless the visitor picked another order.
  const sort = searchParams.get('sort') || (searchParams.get('q') ? 'relevant' : 'recent')

  const keyword = searchParams.get('q') || ''

  // A new search starts from page 1 and drops "search for it exactly as typed" from the previous one.
  const search = (value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set('q', value)
    else next.delete('q')
    next.delete('exact')
    next.delete('page')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className={`${styles.toolbar} ${keywordSearch ? styles.withSearch : ''}`}>
      {keywordSearch ? (
        <form
          role="search"
          className={styles.search}
          onSubmit={(e) => {
            e.preventDefault()
            search(String(new FormData(e.currentTarget).get('q') ?? '').trim())
          }}
        >
          {/* key: the box shows the URL's query again after "Clear search" or a link to another one. */}
          <input
            key={keyword}
            type="search"
            name="q"
            defaultValue={keyword}
            className={styles.searchInput}
            placeholder="Search title, company or skill…"
            aria-label="Search jobs"
            maxLength={80}
          />
        </form>
      ) : null}

      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="secondary" size="sm" className={styles.mobileOnly}>
            Filters
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className={filterStyles.drawerContent}>
          <SheetHeader>
            <SheetTitle className="text-foreground">Filters</SheetTitle>
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

    </div>
  )
}
