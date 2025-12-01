// lib/seo/meta.ts
import type { Metadata } from 'next'
import type { JobSlice } from '../slices/types'

type MetaContext = {
  page: number
  totalJobs?: number
}

function siteName() {
  return 'Remote100k'
}

function countryNameFromCode(code?: string): string {
  if (!code) return ''
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

function humanize(str: string = ''): string {
  return str
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ----------------------------------------------------
   Title + Description
---------------------------------------------------- */

export function buildSliceTitle(slice: JobSlice, ctx: MetaContext): string {
  const f = slice.filters
  const band = f.minAnnual ? `${Math.round(f.minAnnual / 1000)}k+` : null
  const roleSlug = f.roleSlugs?.[0]
  const role = roleSlug ? humanize(roleSlug) : null
  const country = f.countryCode ? countryNameFromCode(f.countryCode) : null

  let base: string

  if (band && role && country) {
    base = `${band} ${role} jobs in ${country}`
  } else if (band && country) {
    base = `${band} jobs in ${country}`
  } else if (band && role) {
    base = `${band} ${role} jobs`
  } else if (band) {
    base = `${band} jobs`
  } else if (role && country) {
    base = `${role} jobs in ${country}`
  } else if (role) {
    base = `${role} jobs`
  } else {
    base = 'Remote $100k+ jobs'
  }

  if (ctx.page > 1) {
    base += ` – Page ${ctx.page}`
  }

  return `${base} | ${siteName()}`
}

export function buildSliceDescription(
  slice: JobSlice,
  ctx: MetaContext
): string {
  const f = slice.filters
  const band = f.minAnnual ? `${Math.round(f.minAnnual / 1000)}k+` : null
  const roleSlug = f.roleSlugs?.[0]
  const role = roleSlug ? humanize(roleSlug) : null
  const country = f.countryCode ? countryNameFromCode(f.countryCode) : null

  const parts: string[] = []

  parts.push('Discover curated')

  if (band) parts.push(band)
  if (role) parts.push(role)
  parts.push('jobs')

  if (country) {
    parts.push('in', country)
  }

  parts.push('from top companies hiring now.')

  if (typeof ctx.totalJobs === 'number' && ctx.totalJobs > 0) {
    parts.push(
      `${ctx.totalJobs.toLocaleString()}+ live roles, updated daily on ${siteName()}.`
    )
  } else {
    parts.push(`Updated daily on ${siteName()}.`)
  }

  return parts.join(' ')
}

/* ----------------------------------------------------
   Canonical URL + Metadata
---------------------------------------------------- */

export function buildCanonicalUrl(slice: JobSlice, page: number): string {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const basePath = '/' + slice.slug.replace(/^\/+/, '')

  if (page <= 1) return origin + basePath
  return `${origin}${basePath}?page=${page}`
}

export function buildSliceMetadata(
  slice: JobSlice,
  ctx: MetaContext
): Metadata {
  const title = buildSliceTitle(slice, ctx)
  const description = buildSliceDescription(slice, ctx)
  const canonical = buildCanonicalUrl(slice, ctx.page)
  const allowIndex = typeof ctx.totalJobs === 'number' ? ctx.totalJobs >= 3 : true

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: allowIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteName(),
      type: 'website',
    },
  }
}
