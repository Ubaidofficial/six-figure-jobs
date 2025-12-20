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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={c.slug ? `/company/${c.slug}` : '/companies'}
              className="group rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-slate-600 hover:bg-slate-950/60"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-sm font-semibold text-slate-200">
                  {c.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.logoUrl}
                      alt={`${c.name} logo`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    (c.name?.[0] || 'C').toUpperCase()
                  )}
                </div>

                <div className="min-w-0">
                  <div className="line-clamp-1 text-base font-semibold text-slate-100 group-hover:text-white">
                    {c.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {c._count.jobs.toLocaleString()} live $100k+ roles
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
