import Link from 'next/link'
import { prisma } from '../../lib/prisma'
import { SITE_NAME, getSiteUrl } from '../../lib/seo/site'
import {
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
} from '../../lib/jobs/queryJobs'
import { RemoteHero } from '@/components/remote/RemoteHero'

import styles from './RemotePage.module.css'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const total = await prisma.job.count({
    where: {
      isExpired: false,
      AND: [
        buildHighSalaryEligibilityWhere(),
        buildGlobalExclusionsWhere(),
        { OR: [{ remote: true }, { remoteMode: 'remote' }] },
      ],
    },
  })

  const title = `Remote Jobs (Minimum $100k+ USD) (${total.toLocaleString()}) | ${SITE_NAME}`
  const description = `Browse ${total.toLocaleString()} remote six-figure jobs across engineering, product, data, and more. $100k+ remote jobs, remote high paying jobs, six figure remote jobs.`

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/remote`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/remote`,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

function normalizeRemoteRegion(raw?: string | string[]): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (!v) return null
  const value = String(v).trim()
  const allowed = new Set(['global', 'us-only', 'emea', 'apac', 'uk-ireland', 'canada'])
  return allowed.has(value) ? value : null
}

function toTitleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

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

export default async function RemoteJobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) || {}
  const activeRemoteRegion = normalizeRemoteRegion(sp.remoteRegion)

  const baseWhere: any = {
    isExpired: false,
    AND: [
      buildHighSalaryEligibilityWhere(),
      buildGlobalExclusionsWhere(),
      { OR: [{ remote: true }, { remoteMode: 'remote' }] },
      ...(activeRemoteRegion ? [{ remoteRegion: activeRemoteRegion }] : []),
    ],
  }

  const [remoteJobCount, companyGroups, countryGroups, avg] = await Promise.all([
    prisma.job.count({ where: baseWhere }),
    prisma.job.groupBy({
      by: ['companyId'],
      where: { ...baseWhere, companyId: { not: null } },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ['countryCode'],
      where: { ...baseWhere, countryCode: { not: null } },
      _count: { _all: true },
    }),
    prisma.job.aggregate({
      where: {
        ...baseWhere,
        currency: 'USD',
        OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
      },
      _avg: { maxAnnual: true, minAnnual: true },
    }),
  ])

  const companyCount = companyGroups.length
  const countryCount = countryGroups.length
  const avgSalaryUsd = Math.min(
    500_000,
    Math.max(
      100_000,
      asNumber((avg as any)?._avg?.minAnnual ?? (avg as any)?._avg?.maxAnnual) ?? 156_000
    )
  )

  const topRoles = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: { ...baseWhere, roleSlug: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { roleSlug: 'desc' } },
    take: 20,
  })

  const roleList = topRoles
    .filter((r) => Boolean((r as any).roleSlug))
    .map((r) => {
      const slug = String((r as any).roleSlug)
      const count = Number((r as any)._count?._all ?? 0)
      return { slug, count, title: toTitleCase(slug) }
    })

  return (
    <main className={styles.page}>
      <RemoteHero
        remoteJobCount={remoteJobCount}
        companyCount={companyCount}
        countryCount={countryCount}
        avgSalaryUsd={avgSalaryUsd}
        activeRemoteRegion={activeRemoteRegion}
      />

      <section className={styles.section} aria-label="Remote roles">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Explore remote roles</h2>
            <p className={styles.sectionSub}>
              High-paying remote opportunities by role, refreshed frequently from verified sources.
            </p>
          </div>
        </div>

        {roleList.length === 0 ? (
          <div className={styles.empty}>
            No roles found. Try adjusting your filters or clear them to explore all remote opportunities.
          </div>
        ) : (
          <div className={styles.roleGrid}>
            {roleList.map((role) => (
              <Link key={role.slug} href={`/remote/${role.slug}`} className={styles.roleCard}>
                <div className={styles.roleLeft}>
                  <div className={styles.roleName}>{role.title}</div>
                  <div className={styles.roleMeta}>
                    <span className={styles.pill}>{role.count.toLocaleString()} jobs</span>
                    {activeRemoteRegion ? (
                      <span className={styles.pill}>{activeRemoteRegion}</span>
                    ) : null}
                  </div>
                </div>
                <div className={styles.arrow} aria-hidden="true">
                  →
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className={styles.why}>
          <h3 className={styles.whyTitle}>Why Choose Remote $100k+ Jobs?</h3>
          <div className={styles.whyList}>
            {[
              'Work from anywhere in the world',
              'Verified six-figure salaries ($100k+ USD or equivalent)',
              'Premium roles from top tech companies',
              'No location restrictions or relocation required',
              'Refreshed daily with new verified opportunities',
            ].map((item) => (
              <div key={item} className={styles.checkItem}>
                <span className={styles.checkDot} aria-hidden="true">
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
