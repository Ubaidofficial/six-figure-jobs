import type { Prisma } from '@prisma/client'

import { CATEGORY_LINKS } from '@/lib/constants/category-links'
import { LOCATIONS } from '@/lib/constants/homepage'
import { buildWhere } from '@/lib/jobs/queryJobs'
import { SALARY_TIERS, type SalaryTierId } from '@/lib/jobs/salaryTiers'
import { prisma } from '@/lib/prisma'
import { isTier1Role } from '@/lib/roles/canonicalSlugs'
import { countrySlugToCode } from '@/lib/seo/countrySlug'
import {
  CITY_TARGETS,
  INDUSTRY_TARGETS,
  SKILL_TARGETS,
  STATE_TARGETS,
} from '@/lib/seo/pseoTargets'

type SitemapUrlRow = {
  path: string
  total: number
  indexable: boolean
  reason?: string
}

export type BrowseSitemapReport = {
  minJobs: number
  candidates: number
  included: SitemapUrlRow[]
  excluded: SitemapUrlRow[]
}

const TOP_ROLE_SLUGS = [
  'software-engineer',
  'product-manager',
  'data-scientist',
  'data-engineer',
  'backend-engineer',
  'frontend-engineer',
  'full-stack-engineer',
  'devops-engineer',
  'machine-learning-engineer',
  'engineering-manager',
]

const TOP_CITIES = CITY_TARGETS.slice(0, 10)
const TOP_SKILLS = SKILL_TARGETS.slice(0, 15)
const TOP_ROLE_SLUG_SET = new Set(TOP_ROLE_SLUGS)
const TOP_SKILL_SLUG_SET = new Set(TOP_SKILLS.map((s) => s.slug))

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function andWhere(
  base: Prisma.JobWhereInput,
  clause: Prisma.JobWhereInput,
): Prisma.JobWhereInput {
  const and = base.AND
    ? Array.isArray(base.AND)
      ? base.AND
      : [base.AND]
    : []

  return { ...base, AND: [...and, clause] }
}

function mapCountRows<T extends string | null>(
  rows: Array<{ key: T; count: number }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.key) continue
    map.set(String(row.key), row.count)
  }
  return map
}

function mapCountRows2(
  rows: Array<{ a: string | null; b: string | null; count: number }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.a || !row.b) continue
    map.set(`${row.a}::${row.b}`, row.count)
  }
  return map
}

function extractRoleSlugFromJobsHref(href: string): string | null {
  const m = href.match(/^\/jobs\/([^/?#]+)$/)
  return m?.[1] ?? null
}

function extractCitySlugFromHref(href: string): string | null {
  const m = href.match(/^\/jobs\/city\/([^/?#]+)$/)
  return m?.[1] ?? null
}

function extractSalaryTierIdFromHref(href: string): SalaryTierId | null {
  const m = href.match(/^\/jobs\/(100k-plus|200k-plus|300k-plus|400k-plus)$/)
  return (m?.[1] as SalaryTierId) ?? null
}

function initializeSkillCounts(): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of SKILL_TARGETS) map.set(s.slug, 0)
  return map
}

function initializeRoleSkillCounts(): Map<string, number> {
  const map = new Map<string, number>()
  for (const role of TOP_ROLE_SLUGS) {
    for (const skill of TOP_SKILLS) {
      map.set(`${role}::${skill.slug}`, 0)
    }
  }
  return map
}

export async function buildBrowseSitemapReport(
  minJobs: number = 3,
): Promise<BrowseSitemapReport> {
  const baseWhere = buildWhere({} as any)
  const remoteWhere = buildWhere({ remoteOnly: true } as any)

  const countryCodes = uniq(
    LOCATIONS.filter((l) => l.code !== 'remote')
      .map((l) => countrySlugToCode(l.code))
      .filter(Boolean) as string[],
  )

  const stateCodes = uniq(STATE_TARGETS.map((s) => s.code.toUpperCase()))
  const industryLabels = uniq(INDUSTRY_TARGETS.map((i) => i.label))
  const citySlugs = uniq(CITY_TARGETS.map((c) => c.slug))
  const cityCountryCodes = uniq(
    CITY_TARGETS.map((c) => c.countryCode?.toUpperCase()).filter(Boolean) as string[],
  )

  const roleSlugs = uniq([
    ...TOP_ROLE_SLUGS,
    ...CATEGORY_LINKS.roles
      .map((r) => extractRoleSlugFromJobsHref(r.href))
      .filter(Boolean),
  ]) as string[]

  const [remoteTotal, countryRows, stateRows, industryRows, cityRows, roleRows, remoteRoleRows, roleCityRows] =
    await Promise.all([
      prisma.job.count({ where: remoteWhere }),
      prisma.job.groupBy({
        by: ['countryCode'],
        where: { ...baseWhere, countryCode: { in: countryCodes } },
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['stateCode'],
        where: { ...baseWhere, stateCode: { in: stateCodes } },
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['industry'],
        where: { ...baseWhere, industry: { in: industryLabels } },
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['citySlug', 'countryCode'],
        where: {
          ...baseWhere,
          citySlug: { in: citySlugs },
          countryCode: { in: cityCountryCodes },
        },
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['roleSlug'],
        where: { ...baseWhere, roleSlug: { in: roleSlugs } },
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['roleSlug'],
        where: { ...remoteWhere, roleSlug: { in: TOP_ROLE_SLUGS } },
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['roleSlug', 'citySlug'],
        where: {
          ...baseWhere,
          roleSlug: { in: TOP_ROLE_SLUGS },
          citySlug: { in: TOP_CITIES.map((c) => c.slug) },
        },
        _count: { _all: true },
      }),
    ])

  const countryCounts = mapCountRows(
    countryRows.map((r: any) => ({
      key: (r as any).countryCode as string | null,
      count: Number((r as any)._count?._all ?? 0),
    })),
  )

  const stateCounts = mapCountRows(
    stateRows.map((r: any) => ({
      key: (r as any).stateCode as string | null,
      count: Number((r as any)._count?._all ?? 0),
    })),
  )

  const industryCounts = mapCountRows(
    industryRows.map((r: any) => ({
      key: (r as any).industry as string | null,
      count: Number((r as any)._count?._all ?? 0),
    })),
  )

  const cityCounts = mapCountRows2(
    cityRows.map((r: any) => ({
      a: (r as any).citySlug as string | null,
      b: (r as any).countryCode as string | null,
      count: Number((r as any)._count?._all ?? 0),
    })),
  )

  const roleCounts = mapCountRows(
    roleRows.map((r: any) => ({
      key: (r as any).roleSlug as string | null,
      count: Number((r as any)._count?._all ?? 0),
    })),
  )

  const remoteRoleCounts = mapCountRows(
    remoteRoleRows.map((r: any) => ({
      key: (r as any).roleSlug as string | null,
      count: Number((r as any)._count?._all ?? 0),
    })),
  )

  const roleCityCounts = mapCountRows2(
    roleCityRows.map((r: any) => ({
      a: (r as any).roleSlug as string | null,
      b: (r as any).citySlug as string | null,
      count: Number((r as any)._count?._all ?? 0),
    })),
  )

  const salaryTierCounts = new Map<SalaryTierId, number>()
  await Promise.all(
    (Object.keys(SALARY_TIERS) as SalaryTierId[]).map(async (tierId) => {
      const tier = SALARY_TIERS[tierId]
      const where = buildWhere({
        currency: 'USD',
        minAnnual: tier.minAnnualUsd,
        ...(tier.maxAnnualUsd ? { maxAnnual: tier.maxAnnualUsd } : {}),
      } as any)
      const count = await prisma.job.count({ where })
      salaryTierCounts.set(tierId, count)
    }),
  )

  const skillCounts = initializeSkillCounts()
  const roleSkillCounts = initializeRoleSkillCounts()

  const skillAnyWhere = andWhere(
    andWhere(baseWhere, { skillsJson: { not: null } }),
    {
      OR: SKILL_TARGETS.map((s) => ({ skillsJson: { contains: s.slug } })),
    },
  )

  const skillRows = await prisma.job.findMany({
    where: skillAnyWhere,
    select: { roleSlug: true, skillsJson: true },
  })

  for (const row of skillRows) {
    const skillsJson = row.skillsJson ?? ''
    if (!skillsJson) continue

    for (const skill of SKILL_TARGETS) {
      if (!skillsJson.includes(skill.slug)) continue
      skillCounts.set(skill.slug, (skillCounts.get(skill.slug) ?? 0) + 1)

      const role = row.roleSlug ?? null
      if (!role) continue
      if (!TOP_ROLE_SLUG_SET.has(role)) continue
      if (!TOP_SKILL_SLUG_SET.has(skill.slug)) continue

      const key = `${role}::${skill.slug}`
      roleSkillCounts.set(key, (roleSkillCounts.get(key) ?? 0) + 1)
    }
  }

  const candidates: SitemapUrlRow[] = []

  // Category links
  for (const cat of CATEGORY_LINKS.roles) {
    const roleSlug = extractRoleSlugFromJobsHref(cat.href)
    if (!roleSlug) continue
    const total = roleCounts.get(roleSlug) ?? 0
    candidates.push({
      path: cat.href,
      total,
      indexable: isTier1Role(roleSlug) && total >= minJobs,
      reason: !isTier1Role(roleSlug) ? 'tier2_role' : undefined,
    })
  }

  for (const cat of CATEGORY_LINKS.locations) {
    const citySlug = extractCitySlugFromHref(cat.href)
    if (cat.href === '/remote') {
      candidates.push({
        path: '/remote',
        total: remoteTotal,
        indexable: remoteTotal >= minJobs,
      })
      continue
    }
    if (citySlug) {
      const city = CITY_TARGETS.find((c) => c.slug === citySlug)
      const key = `${citySlug}::${city?.countryCode?.toUpperCase() ?? ''}`
      const total = cityCounts.get(key) ?? 0
      candidates.push({
        path: cat.href,
        total,
        indexable: total >= minJobs,
      })
    }
  }

  for (const cat of CATEGORY_LINKS.salaryTiers) {
    const tierId = extractSalaryTierIdFromHref(cat.href)
    if (!tierId) continue
    const total = salaryTierCounts.get(tierId) ?? 0
    candidates.push({
      path: cat.href,
      total,
      indexable: total >= minJobs,
    })
  }

  // Country/location pages
  for (const loc of LOCATIONS) {
    if (loc.code === 'remote') {
      candidates.push({
        path: '/remote',
        total: remoteTotal,
        indexable: remoteTotal >= minJobs,
      })
      continue
    }

    const countryCode = countrySlugToCode(loc.code)
    const total = countryCode ? (countryCounts.get(countryCode) ?? 0) : 0
    candidates.push({
      path: `/jobs/location/${loc.code}`,
      total,
      indexable: total >= minJobs,
      reason: countryCode ? undefined : 'unknown_country_slug',
    })
  }

  // States
  for (const state of STATE_TARGETS) {
    const total = stateCounts.get(state.code.toUpperCase()) ?? 0
    candidates.push({
      path: `/jobs/state/${state.slug}`,
      total,
      indexable: total >= minJobs,
    })
  }

  // Skills
  for (const skill of SKILL_TARGETS) {
    const total = skillCounts.get(skill.slug) ?? 0
    candidates.push({
      path: `/jobs/skills/${skill.slug}`,
      total,
      indexable: total >= minJobs,
    })
  }

  // Industries
  for (const industry of INDUSTRY_TARGETS) {
    const total = industryCounts.get(industry.label) ?? 0
    candidates.push({
      path: `/jobs/industry/${industry.slug}`,
      total,
      indexable: total >= minJobs,
    })
  }

  // Cities
  for (const city of CITY_TARGETS) {
    const key = `${city.slug}::${city.countryCode?.toUpperCase() ?? ''}`
    const total = cityCounts.get(key) ?? 0
    candidates.push({
      path: `/jobs/city/${city.slug}`,
      total,
      indexable: total >= minJobs,
    })
  }

  // Combo routes: role + remote
  for (const roleSlug of TOP_ROLE_SLUGS) {
    const total = remoteRoleCounts.get(roleSlug) ?? 0
    candidates.push({
      path: `/remote/${roleSlug}`,
      total,
      indexable: isTier1Role(roleSlug) && total >= minJobs,
      reason: !isTier1Role(roleSlug) ? 'tier2_role' : undefined,
    })

    for (const city of TOP_CITIES) {
      const totalCity = roleCityCounts.get(`${roleSlug}::${city.slug}`) ?? 0
      candidates.push({
        path: `/jobs/${roleSlug}/city/${city.slug}`,
        total: totalCity,
        indexable: totalCity >= minJobs,
      })
    }
  }

  // Combo routes: role + skill (top combos only)
  for (const roleSlug of TOP_ROLE_SLUGS) {
    for (const skill of TOP_SKILLS) {
      const key = `${roleSlug}::${skill.slug}`
      const total = roleSkillCounts.get(key) ?? 0
      candidates.push({
        path: `/jobs/${roleSlug}/skills/${skill.slug}`,
        total,
        indexable: total >= minJobs,
      })
    }
  }

  // De-dupe by path, keeping the max total and most permissive indexable flag.
  const deduped = new Map<string, SitemapUrlRow>()
  for (const row of candidates) {
    const prev = deduped.get(row.path)
    if (!prev) {
      deduped.set(row.path, row)
      continue
    }
    deduped.set(row.path, {
      ...prev,
      total: Math.max(prev.total, row.total),
      indexable: prev.indexable || row.indexable,
      reason: prev.reason ?? row.reason,
    })
  }

  const included: SitemapUrlRow[] = []
  const excluded: SitemapUrlRow[] = []

  for (const row of deduped.values()) {
    if (row.indexable && row.total >= minJobs) included.push(row)
    else {
      excluded.push({
        ...row,
        reason:
          row.reason ??
          (row.total < minJobs
            ? 'below_min_jobs'
            : row.indexable
              ? 'unknown'
              : 'noindex'),
      })
    }
  }

  included.sort((a, b) => a.path.localeCompare(b.path))
  excluded.sort((a, b) => a.path.localeCompare(b.path))

  return {
    minJobs,
    candidates: candidates.length,
    included,
    excluded,
  }
}
