import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { loadSliceFromParams } from '../../../lib/slices/loadSlice'
import { queryJobs } from '../../../lib/jobs/queryJobs'
import { SlicePage } from '../_components/SlicePage'
import { buildSliceMetadata } from '../../../lib/seo/meta'
import {
  buildJobListJsonLd,
  buildBreadcrumbJsonLd,
} from '../../../lib/seo/structuredData'
import { buildSliceInternalLinks } from '../../../lib/navigation/internalLinks'

export const revalidate = 3600

type PageSearchParams = {
  page?: string | string[]
  [key: string]: string | string[] | undefined
}

type MetadataProps = {
  params: Promise<{ slug?: string[] }>
  searchParams?: PageSearchParams | Promise<PageSearchParams>
}

type PageProps = {
  params: Promise<{ slug?: string[] }>
  searchParams?: PageSearchParams | Promise<PageSearchParams>
}

const PAGE_SIZE = 20

function buildCanonicalPath(sliceSlug: string, page: number): string {
  const base = sliceSlug.startsWith('/') ? sliceSlug : `/${sliceSlug}`
  if (page > 1) return `${base}?page=${page}`
  return base
}

function buildRequestedPath(
  slugSegments: string[] | undefined,
  sp: PageSearchParams
): string {
  const base = '/' + (slugSegments ?? []).join('/')
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page
  if (rawPage) return `${base}?page=${rawPage}`
  return base
}

function normalizePathWithQuery(path: string): string {
  const [pathname, query] = path.split('?')
  const cleanPath = pathname.replace(/\/+$/, '') || '/'
  return query ? `${cleanPath}?${query}` : cleanPath
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
  input?: PageSearchParams | Promise<PageSearchParams>
): Promise<PageSearchParams> {
  if (!input) return {}
  if (typeof (input as any).then === 'function') {
    const resolved = (await input) || {}
    return resolved as PageSearchParams
  }
  return input as PageSearchParams
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
    pageSize: 1,
  })

  return buildSliceMetadata(slice, {
    page,
    totalJobs: data.total,
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

  // Enforce canonical slice URL (slug normalization + dropping page=1)
  const canonicalPath = normalizePathWithQuery(
    buildCanonicalPath(slice.slug, page)
  )
  const requestedPath = normalizePathWithQuery(
    buildRequestedPath(resolvedParams.slug, sp)
  )
  if (requestedPath !== canonicalPath) {
    redirect(canonicalPath)
  }

  const data = await queryJobs({
    ...slice.filters,
    page,
    pageSize: PAGE_SIZE,
  })

  const jobListJsonLd = buildJobListJsonLd(slice, data)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(slice)
  const internalLinks = buildSliceInternalLinks(slice)

  return (
    <>
      <SlicePage slice={slice} data={data} />

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
