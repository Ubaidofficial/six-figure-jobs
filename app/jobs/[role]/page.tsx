import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { buildWhere } from '@/lib/jobs/queryJobs'
import { isCanonicalSlug, isTier1Role } from '@/lib/roles/canonicalSlugs'
import { findBestMatchingRole } from '@/lib/roles/slugMatcher'

import { RoleTemplate, buildRoleMetadata } from '../_components/RoleTemplate'

export const revalidate = 300

type SearchParams = Record<string, string | string[] | undefined>

function asNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'object') {
    const v: any = value
    if (typeof v.toNumber === 'function') {
      const n = v.toNumber()
      return Number.isFinite(n) ? n : null
    }
    if (typeof v.toString === 'function') {
      const n = Number(v.toString())
      return Number.isFinite(n) ? n : null
    }
  }
  return null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>
}): Promise<Metadata> {
  const { role: roleRaw } = await params
  const role = roleRaw.toLowerCase()

  if (!isCanonicalSlug(role)) {
    const matched = findBestMatchingRole(role)
    if (matched) permanentRedirect(`/jobs/${matched}`)
    return { title: 'Not Found', robots: { index: false, follow: false } }
  }

  const where = buildWhere({ roleSlugs: [role], page: 1, pageSize: 1 })
  const [total, avgAgg] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.aggregate({
      where: {
        ...where,
        currency: 'USD',
        OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
      },
      _avg: { maxAnnual: true, minAnnual: true },
    }),
  ])

  if (total === 0) {
    return { title: 'Not Found', robots: { index: false, follow: false } }
  }

  const shouldIndex = isTier1Role(role) && total >= 3
  const avgMax = asNumber((avgAgg as any)?._avg?.maxAnnual)
  const avgMin = asNumber((avgAgg as any)?._avg?.minAnnual)
  const avgUsd = avgMax != null && avgMin != null ? (avgMax + avgMin) / 2 : (avgMax ?? avgMin)

  return {
    ...buildRoleMetadata(role, total, avgUsd),
    robots: shouldIndex ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function RolePage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>
  searchParams?: Promise<SearchParams>
}) {
  const { role: roleRaw } = await params
  const role = roleRaw.toLowerCase()

  if (!isCanonicalSlug(role)) {
    const matched = findBestMatchingRole(role)
    if (matched) permanentRedirect(`/jobs/${matched}`)
    notFound()
  }

  return <RoleTemplate roleSlug={role} searchParams={searchParams} />
}

