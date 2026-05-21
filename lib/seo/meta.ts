// lib/seo/meta.ts
import type { Metadata } from 'next'
import type { JobSlice } from '../slices/types'
import { SITE_NAME } from './site'
import { buildSliceCanonicalUrl } from './canonical'

type MetaContext = {
  page: number
  totalJobs?: number
  pageSize?: number
}

function siteName() {
  return SITE_NAME
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
  const band = f.minAnnual ? `$${Math.round(f.minAnnual / 1000)}k+` : null
  const roleSlug = f.roleSlugs?.[0]
  const role = roleSlug ? humanize(roleSlug) : null
  const country = f.countryCode ? countryNameFromCode(f.countryCode) : null
  const count = typeof ctx.totalJobs === 'number' && ctx.totalJobs > 0
    ? `${ctx.totalJobs.toLocaleString()} `
    : ''

  let base: string

  if (band && role && country) {
    base = `${count}${band} ${role} Jobs in ${country} — Verified Salaries`
  } else if (band && country) {
    base = `${count}${band} Tech Jobs in ${country} — Six Figure Salaries`
  } else if (band && role) {
    base = `${count}${band} ${role} Jobs — Salary Shown Upfront`
  } else if (band) {
    base = `${count}${band} High-Paying Tech Jobs — Apply Direct`
  } else if (role && country) {
    base = `${count}${role} Jobs in ${country} — $100k+ Verified Pay`
  } else if (role) {
    base = `${count}${role} Jobs — $100k+ Salary Verified`
  } else {
    base = 'Remote $100k+ Tech Jobs — Verified Salaries, Direct Apply'
  }

  if (ctx.page > 1) {
    base += ` — Page ${ctx.page}`
  }

  return `${base} | ${siteName()}`
}

export function buildSliceDescription(
  slice: JobSlice,
  ctx: MetaContext
): string {
  const f = slice.filters
  const band = f.minAnnual ? `$${Math.round(f.minAnnual / 1000)}k+` : '$100k+'
  const roleSlug = f.roleSlugs?.[0]
  const role = roleSlug ? humanize(roleSlug) : null
  const country = f.countryCode ? countryNameFromCode(f.countryCode) : null
  const count = typeof ctx.totalJobs === 'number' && ctx.totalJobs > 0
    ? ctx.totalJobs.toLocaleString()
    : null

  let desc: string

  if (role && country) {
    desc = `Browse ${count ? `${count} ` : ''}verified ${band} ${role} jobs in ${country} with salary shown upfront. Apply direct — no recruiters, no entry-level clutter. Refreshed daily from company ATS feeds.`
  } else if (role) {
    desc = `${count ? `${count} ` : ''}verified ${band} ${role} jobs with transparent pay ranges. Skip the guesswork — every listing shows compensation upfront. Apply direct to top tech companies, updated daily.`
  } else if (country) {
    desc = `Find ${count ? `${count} ` : ''}verified ${band} tech jobs in ${country} with published salary ranges. No entry-level noise, no recruiter middlemen — direct apply links from company ATS feeds, updated daily.`
  } else {
    desc = `Browse ${count ? `${count} ` : ''}verified ${band} high-paying tech jobs with salary shown upfront. Apply direct to top companies — no recruiters, no guesswork. Roles updated daily from real company ATS feeds.`
  }

  return desc
}

/* ----------------------------------------------------
   Canonical URL + Metadata
---------------------------------------------------- */

export function buildCanonicalUrl(slice: JobSlice, page: number): string {
  return buildSliceCanonicalUrl(slice.filters, page, slice.slug)
}

export function buildSliceMetadata(
  slice: JobSlice,
  ctx: MetaContext
): Metadata {
  const title = buildSliceTitle(slice, ctx)
  const description = buildSliceDescription(slice, ctx)
  const canonical = buildCanonicalUrl(slice, ctx.page)
  const allowIndex =
    typeof ctx.totalJobs === 'number'
      ? ctx.totalJobs >= 1 && ctx.page <= 5
      : ctx.page <= 5

  const totalPages =
    typeof ctx.totalJobs === 'number'
      ? Math.max(
          1,
          Math.ceil(ctx.totalJobs / Math.max(ctx.pageSize ?? 20, 1))
        )
      : null

  const prev =
    totalPages && ctx.page > 1
      ? buildCanonicalUrl(slice, ctx.page - 1)
      : null
  const next =
    totalPages && ctx.page < totalPages
      ? buildCanonicalUrl(slice, ctx.page + 1)
      : null

  const countryCode = slice.filters.countryCode?.toUpperCase()
  const hreflang =
    allowIndex && countryCode != null
      ? { [`en-${countryCode}`]: canonical, 'x-default': canonical }
      : undefined

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: hreflang,
    },
    other: {
      ...(prev ? { 'link:prev': prev } : {}),
      ...(next ? { 'link:next': next } : {}),
    },
    robots: allowIndex
      ? { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' }
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
