// app/s/[slug]/page.tsx
// Phase-4 Programmatic SEO Slice Page (Role, Salary, Country, Remote, etc.)

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { loadSliceFromParams } from '../../../lib/slices/loadSlice'
import { queryJobs } from '../../../lib/jobs/queryJobs'

import { SlicePage } from '../../jobs/_components/SlicePage'

import { buildSliceMetadata } from '../../../lib/seo/meta'
import {
  buildJobListJsonLd,
  buildBreadcrumbJsonLd,
} from '../../../lib/seo/structuredData'
import { SITE_NAME } from '../../../lib/seo/site'

import { buildSliceInternalLinks } from '../../../lib/navigation/internalLinks'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata(
  { params, searchParams }: PageProps
): Promise<Metadata> {
  const { slug } = await params
  const slice = await loadSliceFromParams([slug])
  if (!slice) {
    return {
      title: `Page not found – ${SITE_NAME}`,
      description: 'This page does not exist.',
    }
  }

  const sp = (await searchParams) || {}
  const rawPage = sp.page
  const pageParam = (Array.isArray(rawPage) ? rawPage[0] : rawPage) || '1'
  const page = Number(pageParam || '1') || 1

  const preview = await queryJobs({
    ...slice.filters,
    page,
    pageSize: 1,
  })

  return buildSliceMetadata(slice, {
    page,
    totalJobs: preview.total,
  })
}

/* -------------------------------------------------------------------------- */
/* Page Render                                                                */
/* -------------------------------------------------------------------------- */

export default async function SliceSeoPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params
  const slice = await loadSliceFromParams([slug])
  if (!slice) return notFound()

  const sp = (await searchParams) || {}
  const rawPage = sp.page
  const pageParam = (Array.isArray(rawPage) ? rawPage[0] : rawPage) || '1'
  const page = Number(pageParam || '1') || 1

  const data = await queryJobs({
    ...slice.filters,
    page,
    pageSize: 20,
  })

  const jobListJsonLd = buildJobListJsonLd(slice, data)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(slice)
  const internalLinks = buildSliceInternalLinks(slice)

  return (
    <>
      <SlicePage slice={slice} data={data} />

      {/* JSON-LD: Job list structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobListJsonLd),
        }}
      />

      {/* JSON-LD: Breadcrumb trail */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />

      {/* Internal links cluster */}
      {internalLinks.length > 0 && (
        <section className="mx-auto mt-10 max-w-5xl px-4 pb-12">
          <h2 className="mb-3 text-lg font-semibold text-gray-100">
            Explore related pages
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
