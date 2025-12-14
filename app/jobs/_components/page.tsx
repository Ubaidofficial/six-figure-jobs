// app/jobs/_components/[Slug]/page.tsx

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { loadSliceFromParams } from '../../../lib/slices/loadSlice'
import { queryJobs } from '../../../lib/jobs/queryJobs'
import { SlicePage } from './SlicePage'
import { buildSliceMetadata } from '../../../lib/seo/meta'
import {
  buildJobListJsonLd,
  buildBreadcrumbJsonLd,
  buildSliceWebPageJsonLd,
  buildSliceFaqJsonLd,
  buildSliceSpeakableJsonLd,
} from '../../../lib/seo/structuredData'
import { buildSliceInternalLinks } from '../../../lib/navigation/internalLinks'
import { resolveSliceCanonicalPath } from '../../../lib/seo/canonical'

export const revalidate = 3600

export type PageSearchParams = {
  page?: string | string[]
  [key: string]: string | string[] | undefined
}

type MetadataProps = {
  params: Promise<{ slug?: string[] }>
  searchParams?: Promise<PageSearchParams>
}

type PageProps = {
  params: Promise<{ slug?: string[] }>
  searchParams?: Promise<PageSearchParams>
}

const PAGE_SIZE = 20

function humanizeRole(slug?: string | null): string | null {
  if (!slug) return null
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function countryNameFromCode(code?: string | null): string | null {
  if (!code) return null
  const upper = code.toUpperCase()
  const map: Record<string, string> = {
    US: 'United States',
    CA: 'Canada',
    GB: 'United Kingdom',
    DE: 'Germany',
    ES: 'Spain',
    IE: 'Ireland',
    AU: 'Australia',
    IN: 'India',
  }
  return map[upper] ?? upper
}

function bandLabel(minAnnual?: number | null): string {
  if (!minAnnual) return '$100k+'
  if (minAnnual >= 400_000) return '$400k+'
  if (minAnnual >= 300_000) return '$300k+'
  if (minAnnual >= 200_000) return '$200k+'
  return '$100k+'
}

// Redirect salary pages to their dedicated routes
function checkSalaryPageRedirect(slug?: string[]) {
  if (!slug || slug.length === 0) return
  
  const path = slug.join('/')
  const salaryPages = ['200k-plus', '300k-plus', '400k-plus']
  
  for (const salaryPage of salaryPages) {
    if (path === salaryPage || path === `${salaryPage}-jobs`) {
      redirect(`/jobs/${salaryPage}`)
    }
  }
}

async function resolveSearchParams(
  input?: Promise<PageSearchParams>
): Promise<PageSearchParams> {
  return (await input) || {}
}

function getPageFromSearchParams(sp: PageSearchParams): number {
  const raw = sp.page
  const v = Array.isArray(raw) ? raw[0] : raw
  const pageNum = Number(v || '1')
  return Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1
}

export async function generateMetadata({
  params,
  searchParams,
}: MetadataProps): Promise<Metadata> {
  const resolvedParams = await params
  checkSalaryPageRedirect(resolvedParams.slug)

  const slice = await loadSliceFromParams(resolvedParams.slug)
  const sp = await resolveSearchParams(searchParams)
  const page = getPageFromSearchParams(sp)

  const data = await queryJobs({
    ...slice.filters,
    page,
    pageSize: PAGE_SIZE,
  })

  return buildSliceMetadata(slice, {
    page,
    totalJobs: data.total,
    pageSize: PAGE_SIZE,
  })
}

export default async function JobsSlicePage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params
  checkSalaryPageRedirect(resolvedParams.slug)
  
  const slice = await loadSliceFromParams(resolvedParams.slug)
  const sp = await resolveSearchParams(searchParams)
  const page = getPageFromSearchParams(sp)

  const canonicalPath = resolveSliceCanonicalPath(
    slice.filters,
    slice.slug
  )
  const requestedPath = `/jobs/${(resolvedParams.slug || []).join('/')}`
  if (requestedPath.replace(/\/+$/, '') !== canonicalPath.replace(/\/+$/, '')) {
    const search = page > 1 ? `?page=${page}` : ''
    redirect(`${canonicalPath}${search}`)
  }

  const data = await queryJobs({
    ...slice.filters,
    page,
    pageSize: PAGE_SIZE,
  })

  const jobListJsonLd = buildJobListJsonLd(slice, data)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(slice)
  const webPageJsonLd = buildSliceWebPageJsonLd(slice, data)
  const faqJsonLd = buildSliceFaqJsonLd(slice, data.total)
  const speakableJsonLd = buildSliceSpeakableJsonLd()
  const internalLinks = buildSliceInternalLinks(slice)
  const roleName = humanizeRole(slice.filters.roleSlugs?.[0])
  const band = bandLabel(slice.filters.minAnnual)
  const countryName = countryNameFromCode(slice.filters.countryCode)
  const remoteLabel = slice.filters.remoteOnly ? 'Remote-first' : null

  return (
    <>
      <SlicePage slice={slice} data={data} />

      <section className="mx-auto mt-10 max-w-5xl px-4">
        <h2 className="text-sm font-semibold text-slate-50">
          High-paying {roleName ? `${roleName} ` : ''}jobs {countryName ? `in ${countryName} ` : ''}{band}
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed text-slate-200"
          data-speakable="summary"
        >
          {band} roles are curated from verified company ATS feeds with salary evidence and six-figure positioning. Listings highlight compensation upfront, note remote or hybrid eligibility{remoteLabel ? ` (${remoteLabel})` : ''}, and stay live only while hiring teams keep them open.
        </p>
        <ul className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            Salary focus: {band} tech and product roles with pay transparency.
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            Location clarity: {slice.filters.remoteOnly ? 'Remote-eligible first' : countryName ? `Open to ${countryName}` : 'Global-friendly where stated'}; hybrid/on-site tagged.
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            Freshness: refreshed frequently; expired postings are removed to avoid stale clicks.
          </li>
        </ul>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobListJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(speakableJsonLd),
        }}
      />

      {internalLinks.length > 0 && (
        <section className="mx-auto mt-10 max-w-5xl px-4 pb-12">
          <h2 className="mb-3 text-sm font-semibold text-slate-50">
            Explore related $100k+ pages
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-blue-400">
            {internalLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:underline">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
