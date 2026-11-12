'use client'

import { useState, useMemo } from 'react'
import Link from '@/components/ui/Link'
import { Search, X } from 'lucide-react'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { buildLogoUrl } from '@/lib/companies/logo'
import type { PublicCompanyDirectoryEntry } from '@/lib/jobs/publicStats'

import styles from './CompanySearch.module.css'

function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.mark}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

/** `noun` names what the count counts ("remote job" on /remote/companies); plural adds an s. */
export function CompanySearch({ companies, noun = 'job' }: { companies: PublicCompanyDirectoryEntry[]; noun?: string }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => (c.name ?? '').toLowerCase().includes(q))
  }, [query, companies])

  return (
    <div>
      <div className={styles.search}>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies on this page"
          className={styles.input}
          aria-label="Search companies on this page"
        />
        {query ? (
          <button type="button" onClick={() => setQuery('')} className={styles.clear} aria-label="Clear search">
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {query ? (
        <p className={styles.status} role="status">
          {filtered.length === 0
            ? 'No companies match your search'
            : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'company' : 'companies'} found`}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className={styles.empty}>No companies match &ldquo;{query}&rdquo;</div>
      ) : (
        <ul className={styles.grid} style={{ padding: 0, listStyle: 'none' }}>
          {filtered.map((c) => (
            <li key={c.id}>
              <Link href={c.slug ? `/company/${c.slug}` : '/companies'} className={styles.tile}>
                <CompanyLogo name={c.name ?? ''} src={buildLogoUrl(c.logoUrl, c.website, c.name)} size="lg" />
                <span className={styles.text}>
                  <span className={styles.name}>{highlight(c.name ?? '', query)}</span>
                  <span className={styles.meta}>
                    {c._count.jobs.toLocaleString()} {c._count.jobs === 1 ? noun : `${noun}s`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
