import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const revalidate = 600 // 10m
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Companies hiring $100k+ roles | 6FigJobs',
  description:
    'Explore companies hiring for verified $100k+ roles. Apply directly on company sites.',
  alternates: { canonical: 'https://www.6figjobs.com/companies' },
}

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    where: {
      jobs: {
        some: {
          isExpired: false,
          OR: [
            { minAnnual: { gte: BigInt(100_000) } },
            { maxAnnual: { gte: BigInt(100_000) } },
            { isHundredKLocal: true },
          ],
        },
      },
    },
    orderBy: { name: 'asc' },
    take: 500,
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      _count: {
        select: {
          jobs: {
            where: {
              isExpired: false,
              OR: [
                { minAnnual: { gte: BigInt(100_000) } },
                { maxAnnual: { gte: BigInt(100_000) } },
                { isHundredKLocal: true },
              ],
            },
          },
        },
      },
    },
  })

  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">
          Companies hiring $100k+ roles
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Only companies with live high-paying roles. Apply directly on the company site.
        </p>
      </header>

      {companies.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center">
          <p className="text-slate-400">No companies found yet. Try again soon — listings update frequently.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={c.slug ? `/company/${c.slug}` : '/companies'}
              className="group flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-950/40 p-6 shadow-sm transition hover:border-slate-600 hover:bg-slate-950/60 hover:shadow-lg"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-lg font-bold text-slate-200">
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logoUrl}
                    alt=""
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  (c.name?.[0] || 'C').toUpperCase()
                )}
              </div>

              <div className="w-full text-center">
                <div className="mb-1 line-clamp-2 text-sm font-semibold text-slate-100 group-hover:text-white">
                  {c.name}
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                  💼 {c._count.jobs.toLocaleString()} jobs
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
