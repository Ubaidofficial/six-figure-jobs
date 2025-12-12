import Link from 'next/link'
import { prisma } from '../../lib/prisma'
import { SITE_NAME, getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()

export async function generateMetadata() {
  const total = await prisma.job.count({
    where: {
      isExpired: false,
      AND: [
        {
          OR: [
            { minAnnual: { gte: BigInt(100_000) } },
            { maxAnnual: { gte: BigInt(100_000) } },
            { isHundredKLocal: true },
            { isHighSalaryLocal: true },
          ],
        },
        { OR: [{ remote: true }, { remoteMode: 'remote' }] },
      ],
    },
  })

  const title = `Remote $100k+ Jobs (${total.toLocaleString()}) | ${SITE_NAME}`
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

export default async function RemoteJobsPage() {
  // Get top remote roles with job counts
  const topRoles = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: {
      isExpired: false,
      AND: [
        { OR: [{ remote: true }, { remoteMode: 'remote' }] },
        {
          OR: [
            { minAnnual: { gte: BigInt(100_000) } },
            { maxAnnual: { gte: BigInt(100_000) } },
            { isHundredKLocal: true },
            { isHighSalaryLocal: true },
          ],
        },
      ],
    },
    _count: true,
    orderBy: {
      _count: {
        roleSlug: 'desc',
      },
    },
    take: 20,
  })

  const roleList = topRoles
    .filter(r => r.roleSlug)
    .map(r => ({
      slug: r.roleSlug!,
      count: r._count,
      title: r.roleSlug!.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    }))

  const totalCount = roleList.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-4 text-4xl font-bold text-white">
        Remote $100k+ Jobs ({totalCount.toLocaleString()})
      </h1>
      <p className="mb-8 text-lg text-slate-300">
        Browse {totalCount.toLocaleString()} remote six-figure jobs across all roles. 
        Work from anywhere with premium compensation.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roleList.map(role => (
          <Link
            key={role.slug}
            href={`/remote/${role.slug}`}
            className="group rounded-lg border border-slate-700 bg-slate-800/50 p-6 transition hover:border-cyan-500 hover:bg-slate-800"
          >
            <h2 className="mb-2 text-xl font-semibold text-white group-hover:text-cyan-400">
              {role.title}
            </h2>
            <p className="text-sm text-slate-400">
              {role.count.toLocaleString()} remote jobs
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-12 rounded-lg border border-slate-700 bg-slate-800/30 p-6">
        <h2 className="mb-4 text-2xl font-bold text-white">
          Why Choose Remote $100k+ Jobs?
        </h2>
        <ul className="space-y-2 text-slate-300">
          <li>✓ Work from anywhere in the world</li>
          <li>✓ Verified six-figure salaries ($100k+ USD or equivalent)</li>
          <li>✓ Premium roles from top tech companies</li>
          <li>✓ No location restrictions or relocation required</li>
          <li>✓ Updated daily with fresh opportunities</li>
        </ul>
      </div>
    </div>
  )
}
