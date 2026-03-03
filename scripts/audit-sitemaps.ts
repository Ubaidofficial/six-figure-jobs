/**
 * Audit sitemap counts + duplicate URLs across non-job-detail sitemaps.
 *
 * Usage:
 *   npx tsx scripts/audit-sitemaps.ts
 */

import { prisma } from '../lib/prisma'
import { buildWhere, buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere } from '../lib/jobs/queryJobs'
import { CITY_TARGETS } from '../lib/seo/pseoTargets'
import { countryCodeToSlug } from '../lib/seo/countrySlug'
import { isCanonicalSlug, isTier1Role } from '../lib/roles/canonicalSlugs'
import { resolveSliceCanonicalPath } from '../lib/seo/canonical'
import type { SliceFilters } from '../lib/slices/types'
import { buildBrowseSitemapReport } from '../lib/seo/browseSitemap'

const MIN_INDEXABLE_JOBS = 3

const CATEGORY_ROLE_MAP: Record<string, string[]> = {
  engineering: [
    'software-engineer',
    'backend',
    'frontend',
    'full-stack',
    'mobile',
    'ios',
    'android',
    'platform',
    'systems',
    'application',
    'devops',
    'sre',
    'infrastructure',
    'web-developer',
  ],
  product: ['product-manager', 'product-owner', 'product'],
  data: ['data-scientist', 'data-engineer', 'analytics', 'data-analyst'],
  design: ['designer', 'design', 'ux', 'ui', 'product-designer'],
  devops: ['devops', 'sre', 'site-reliability'],
  mlai: ['machine-learning', 'ml', 'ai', 'artificial-intelligence'],
  sales: ['sales', 'account-executive', 'sdr', 'bdr'],
  marketing: ['marketing', 'growth', 'demand-generation', 'seo', 'performance'],
}

const COUNTRIES = ['us', 'gb', 'ca', 'de', 'au', 'fr', 'nl', 'se']
const LEVELS = ['entry', 'mid', 'senior', 'lead', 'executive']
const SALARY_TIER_PATHS = new Set([
  '/jobs/100k-plus',
  '/jobs/200k-plus',
  '/jobs/300k-plus',
  '/jobs/400k-plus',
])
const SALARY_BANDS = new Set(['100k-plus', '200k-plus', '300k-plus', '400k-plus'])

function normalizeSlicePath(pathOrSlug: string): string | null {
  const raw = pathOrSlug.startsWith('/') ? pathOrSlug : `/${pathOrSlug}`
  const parts = raw.split('/').filter(Boolean)
  if (parts.length === 0) return null
  if (parts[0] !== 'jobs') return raw

  const bandIndex = parts.findIndex((p) => SALARY_BANDS.has(p))
  if (bandIndex === -1) return raw

  const band = parts[bandIndex]
  const remote = parts.includes('remote')
  const rest = parts.slice(1).filter((p) => p !== band && p !== 'remote')
  const role = rest[0]
  const tail = rest.slice(1)

  const out: string[] = ['jobs', band]
  if (remote) out.push('remote')
  if (role) out.push(role)
  if (tail.length) out.push(...tail)
  return '/' + out.join('/')
}

function normalizeSliceFilters(filters: SliceFilters | null): SliceFilters | null {
  if (!filters) return null
  const next: any = { ...filters }
  if (!Array.isArray(next.roleSlugs) && typeof next.roleSlug === 'string') {
    next.roleSlugs = [next.roleSlug]
  }
  return next as SliceFilters
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

async function getCityUrls(): Promise<string[]> {
  const baseWhere = buildWhere({} as any)
  const citySlugs = CITY_TARGETS.map((c) => c.slug)

  const rows = await prisma.job.groupBy({
    by: ['citySlug'],
    where: { ...baseWhere, citySlug: { in: citySlugs } },
    _count: { _all: true },
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = String(row.citySlug ?? '').toLowerCase()
    if (!key) continue
    counts.set(key, Number(row._count?._all ?? 0))
  }

  return CITY_TARGETS
    .filter((c) => (counts.get(c.slug.toLowerCase()) ?? 0) >= MIN_INDEXABLE_JOBS)
    .map((c) => `/jobs/city/${c.slug}`)
}

async function getCountryUrls(): Promise<string[]> {
  const baseWhere = buildWhere({} as any)
  const countryCodes = COUNTRIES.map((c) => c.toUpperCase())

  const rows = await prisma.job.groupBy({
    by: ['countryCode'],
    where: { ...baseWhere, countryCode: { in: countryCodes } },
    _count: { _all: true },
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.countryCode) continue
    counts.set(row.countryCode.toUpperCase(), Number(row._count?._all ?? 0))
  }

  return COUNTRIES
    .filter((code) => (counts.get(code.toUpperCase()) ?? 0) >= MIN_INDEXABLE_JOBS)
    .map((code) => `/jobs/country/${countryCodeToSlug(code)}`)
}

async function getLevelUrls(): Promise<string[]> {
  const baseWhere = buildWhere({} as any)

  const rows = await prisma.job.groupBy({
    by: ['experienceLevel'],
    where: { ...baseWhere, experienceLevel: { in: LEVELS } },
    _count: { _all: true },
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.experienceLevel) continue
    counts.set(String(row.experienceLevel).toLowerCase(), Number(row._count?._all ?? 0))
  }

  return LEVELS
    .filter((level) => (counts.get(level) ?? 0) >= MIN_INDEXABLE_JOBS)
    .map((level) => `/jobs/level/${level}`)
}

async function getCategoryUrls(): Promise<string[]> {
  const baseWhere = buildWhere({} as any)
  const categories = Object.keys(CATEGORY_ROLE_MAP)

  const roleRows = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: { ...baseWhere, roleSlug: { not: null } },
    _count: { _all: true },
  })

  const roleCounts = roleRows
    .map((row) => ({
      slug: row.roleSlug ? String(row.roleSlug).toLowerCase() : '',
      count: Number(row._count?._all ?? 0),
    }))
    .filter((row) => row.slug)

  return categories
    .map((cat) => {
      const slugs = (CATEGORY_ROLE_MAP[cat] || []).map((s) => s.toLowerCase())
      let total = 0
      for (const row of roleCounts) {
        if (slugs.some((slug) => row.slug === slug || row.slug.includes(slug))) {
          total += row.count
        }
      }
      if (total < MIN_INDEXABLE_JOBS) return null
      return `/jobs/category/${cat}`
    })
    .filter(Boolean) as string[]
}

async function getRemoteRoleUrls(): Promise<string[]> {
  const where = {
    isExpired: false,
    AND: [
      buildHighSalaryEligibilityWhere(),
      buildGlobalExclusionsWhere(),
      { OR: [{ remote: true }, { remoteMode: 'remote' }] },
      { roleSlug: { not: null } },
    ],
  } as const

  const rows = await prisma.job.groupBy({
    by: ['roleSlug'],
    where,
    _count: { _all: true },
  })

  return rows
    .map((row) => (row.roleSlug ? String(row.roleSlug).toLowerCase() : ''))
    .filter((slug) => slug && isCanonicalSlug(slug) && isTier1Role(slug))
    .map((slug) => `/remote/${slug}`)
}

async function getSalaryUrls(): Promise<string[]> {
  return ['/jobs/100k-plus', '/jobs/200k-plus', '/jobs/300k-plus', '/jobs/400k-plus']
}

async function getBrowseUrls(): Promise<string[]> {
  const report = await buildBrowseSitemapReport(MIN_INDEXABLE_JOBS)
  return report.included.map((row) => row.path)
}

async function getSliceUrls(): Promise<{ priority: string[]; longtail: string[] }> {
  const [priority, longtail] = await Promise.all([
    prisma.jobSlice.findMany({
      select: { slug: true, filtersJson: true },
      where: { type: 'role-salary', jobCount: { gte: 10 } },
    }),
    prisma.jobSlice.findMany({
      select: { slug: true, filtersJson: true },
      where: {
        jobCount: { gte: 5, lt: 20 },
        NOT: {
          type: 'role-salary',
          jobCount: { gte: 10 },
        },
      },
    }),
  ])

  const toPath = (slug: string, filtersJson: string | null): string | null => {
    const filters: SliceFilters | null = (() => {
      if (!filtersJson) return null
      try {
        return JSON.parse(filtersJson)
      } catch {
        return null
      }
    })()

    const normalizedFilters = normalizeSliceFilters(filters)

    const rawPath = normalizedFilters ? resolveSliceCanonicalPath(normalizedFilters, slug) : `/${slug}`
    const path = rawPath ? normalizeSlicePath(rawPath) : null
    if (!path || !path.startsWith('/')) return null
    if (SALARY_TIER_PATHS.has(path)) return null
    return path
  }

  const buildSet = (rows: Array<{ slug: string; filtersJson: string | null }>) => {
    const byLoc = new Set<string>()
    for (const row of rows) {
      const path = toPath(row.slug, row.filtersJson)
      if (!path) continue
      byLoc.add(path)
    }
    return Array.from(byLoc.values()).sort()
  }

  return {
    priority: buildSet(priority),
    longtail: buildSet(longtail),
  }
}

async function getCompanyUrls(): Promise<string[]> {
  const rows = await prisma.job.groupBy({
    by: ['companyId'],
    where: { isExpired: false, companyId: { not: null } },
    _count: { _all: true },
  })

  const eligibleIds = rows
    .filter((r) => Number(r._count?._all ?? 0) >= MIN_INDEXABLE_JOBS)
    .map((r) => r.companyId)
    .filter((id): id is string => Boolean(id))

  if (eligibleIds.length === 0) return []

  const companies = await prisma.company.findMany({
    where: { id: { in: eligibleIds } },
    select: { slug: true },
  })

  return companies
    .filter((c) => c.slug)
    .map((c) => `/company/${c.slug}`)
}

async function main() {
  const [city, country, level, category, remote, salary, browse, slices, company] = await Promise.all([
    getCityUrls(),
    getCountryUrls(),
    getLevelUrls(),
    getCategoryUrls(),
    getRemoteRoleUrls(),
    getSalaryUrls(),
    getBrowseUrls(),
    getSliceUrls(),
    getCompanyUrls(),
  ])

  const sitemapSets: Array<{ name: string; urls: string[] }> = [
    { name: 'sitemap-city.xml', urls: city },
    { name: 'sitemap-country.xml', urls: country },
    { name: 'sitemap-level.xml', urls: level },
    { name: 'sitemap-category.xml', urls: category },
    { name: 'sitemap-remote.xml', urls: remote },
    { name: 'sitemap-salary.xml', urls: salary },
    { name: 'sitemap-browse.xml', urls: browse },
    { name: 'sitemap-slices/priority', urls: slices.priority },
    { name: 'sitemap-slices/longtail', urls: slices.longtail },
    { name: 'sitemap-company.xml', urls: company },
  ]

  const urlToSitemaps = new Map<string, Set<string>>()
  for (const set of sitemapSets) {
    for (const url of set.urls) {
      const entry = urlToSitemaps.get(url) ?? new Set<string>()
      entry.add(set.name)
      urlToSitemaps.set(url, entry)
    }
  }

  console.log('**Sitemap Counts (non-job-detail)**')
  for (const set of sitemapSets) {
    console.log(`- ${set.name}: ${set.urls.length}`)
  }

  const duplicates = Array.from(urlToSitemaps.entries())
    .filter(([, sitemaps]) => sitemaps.size > 1)
    .map(([url, sitemaps]) => ({
      url,
      sitemaps: Array.from(sitemaps.values()).sort(),
    }))
    .sort((a, b) => a.url.localeCompare(b.url))

  console.log('')
  console.log(`**Duplicate URLs Across Sitemaps: ${duplicates.length}**`)

  const sample = duplicates.slice(0, 50)
  for (const row of sample) {
    console.log(`- ${row.url} -> ${row.sitemaps.join(', ')}`)
  }

  if (duplicates.length > sample.length) {
    console.log(`- ... ${duplicates.length - sample.length} more`)
  }
}

main().catch((err) => {
  console.error('[audit-sitemaps] error:', err)
  process.exitCode = 1
})
