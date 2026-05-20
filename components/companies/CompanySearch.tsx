'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { buildLogoUrl } from '@/lib/companies/logo'
import type { PublicCompanyDirectoryEntry } from '@/lib/jobs/publicStats'

// URLs that aren't real company homepages — filter these out of "Website" button
const INVALID_WEBSITE_PATTERNS = [
  'linkedin.com',
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workday.com',
  'smartrecruiters.com',
  'bamboohr.com',
  'recruitee.com',
  'workable.com',
  'jobs.lever.co',
]

function isValidCompanyWebsite(url: string | null): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return !INVALID_WEBSITE_PATTERNS.some((p) => parsed.hostname.includes(p))
  } catch {
    return false
  }
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-emerald-500/20 text-emerald-300 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function CompanySearch({ companies }: { companies: PublicCompanyDirectoryEntry[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => (c.name ?? '').toLowerCase().includes(q))
  }, [query, companies])

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies… e.g. Nvidia, Google, Stripe"
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-3 pl-11 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition"
          aria-label="Search companies"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-200 transition"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Result count */}
      {query && (
        <p className="mb-4 text-xs text-slate-400">
          {filtered.length === 0
            ? 'No companies match your search'
            : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'company' : 'companies'} found`}
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-10 text-center text-slate-400 text-sm">
          No companies match &ldquo;{query}&rdquo;
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((c) => {
            const logoUrl = buildLogoUrl(c.logoUrl, c.website)
            const hasValidWebsite = isValidCompanyWebsite(c.website)

            return (
              <Link
                key={c.id}
                href={c.slug ? `/company/${c.slug}` : '/companies'}
                className="group flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-950/40 p-6 shadow-sm transition hover:border-emerald-700/50 hover:bg-slate-950/60 hover:shadow-lg"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-lg font-bold text-slate-200">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={`${c.name} logo`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement
                        el.style.display = 'none'
                        const parent = el.parentElement
                        if (parent) {
                          parent.textContent = (c.name?.[0] || 'C').toUpperCase()
                        }
                      }}
                    />
                  ) : (
                    (c.name?.[0] || 'C').toUpperCase()
                  )}
                </div>

                <div className="w-full text-center">
                  <div className="mb-1 line-clamp-2 text-sm font-semibold text-slate-100 group-hover:text-white">
                    {highlight(c.name ?? '', query)}
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                    💼 {c._count.jobs.toLocaleString()} jobs
                  </div>
                  {hasValidWebsite && (
                    <div className="mt-1 text-[10px] text-slate-500 truncate px-1">
                      {new URL(c.website!.startsWith('http') ? c.website! : `https://${c.website!}`).hostname.replace(/^www\./, '')}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
