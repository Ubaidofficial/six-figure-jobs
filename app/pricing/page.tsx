// app/pricing/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Pricing | Post $100k+ Jobs | Six Figure Jobs',
  description:
    'Affordable job posting packages for $100k+ positions. Reach qualified candidates actively seeking high-paying roles. Starting at $299/post.',
  alternates: {
    canonical: 'https://6figjobs.com/pricing',
  },
  openGraph: {
    title: 'Pricing | Post $100k+ Jobs | Six Figure Jobs',
    description: 'Affordable job posting packages for $100k+ positions.',
    url: 'https://6figjobs.com/pricing',
    siteName: 'Six Figure Jobs',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | Six Figure Jobs',
    description: 'Affordable job posting packages for $100k+ positions.',
  },
}

const tiers = [
  {
    name: 'Featured',
    price: '$99',
    badge: 'Most popular',
    description:
      '14-day promoted placement for a $100k+ role. Salary shown, direct apply, remote/hybrid eligible.',
    features: [
      'Highlighted above standard listings for 14 days',
      'Remote, hybrid, or on-site tags',
      'Salary visible to increase applies',
      'Direct apply link (no friction)',
      'Appears in relevant $100k+ slices',
    ],
    cta: 'Post a job',
    href: '/post-a-job',
  },
  {
    name: 'Boosted',
    price: '$199',
    badge: 'Best reach',
    description:
      '30-day boosted placement for competitive roles. Extra exposure in email digests and role/location slices.',
    features: [
      '30-day boosted placement',
      'Featured in email digest for your role/location',
      'Appears in top salary slices ($100k+/ $200k+)',
      'Remote + hybrid eligible; salary required',
      'Direct apply link and company logo',
    ],
    cta: 'Talk to us',
    href: 'mailto:hi@sixfigurejobs.com',
  },
  {
    name: 'Team / ATS',
    price: 'Let’s chat',
    badge: 'Enterprise',
    description:
      'Bulk posting, ATS integration, and performance reporting for hiring teams.',
    features: [
      'Bulk posting & ATS integration',
      'Custom branding and logo handling',
      'Performance reporting and weekly refresh',
      'Priority placement for hard-to-fill roles',
      'Invoice billing available',
    ],
    cta: 'Contact sales',
    href: 'mailto:hi@sixfigurejobs.com',
  },
]

const faqs = [
  {
    q: 'Is salary required?',
    a: 'Yes. We highlight $100k+ roles only. Showing salary increases apply rate and filters you into the right slices.',
  },
  {
    q: 'Do you accept remote and hybrid roles?',
    a: 'Yes. We tag remote, hybrid, and on-site so candidates can filter. Remote is further split by region (US-only, EMEA, APAC, global).',
  },
  {
    q: 'How long does a featured post run?',
    a: 'Featured runs 14 days. Boosted runs 30 days with added email and slice exposure.',
  },
  {
    q: 'Can I integrate my ATS?',
    a: 'Enterprise plans can sync from ATS feeds (Greenhouse, Lever, Workday) or via API/bulk upload.',
  },
]

const integrations = [
  'Greenhouse',
  'Lever',
  'Workday',
  'Ashby',
  'RemoteOK',
  'Remotive',
  'WeWorkRemotely',
]

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-10 space-y-10">
      <header className="rounded-3xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-950/70 to-slate-900 p-8 shadow-xl shadow-slate-900/40">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Pricing
            </p>
            <h1 className="text-3xl font-semibold text-slate-50">
              Promote your $100k+ role to verified six-figure talent
            </h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Choose a featured or boosted placement for your $100k+ openings. Remote, hybrid, and on-site are welcome—salary required to keep quality high. Direct apply links, salary visible, and reach across role/location slices.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-200">
              <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
                14–30 day promoted slots
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
                Remote + hybrid eligible
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
                Salary visible to candidates
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/post-a-job"
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
            >
              Post a job
            </Link>
            <Link
              href="mailto:hi@sixfigurejobs.com"
              className="rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="relative flex h-full flex-col rounded-2xl border border-slate-900 bg-slate-950/70 p-6 shadow-md shadow-slate-900/30"
          >
            {tier.badge && (
              <span className="absolute right-4 top-4 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-600/50">
                {tier.badge}
              </span>
            )}
            <p className="text-sm font-semibold text-slate-50">{tier.name}</p>
            <p className="mt-2 text-3xl font-bold text-slate-50">
              {tier.price}
            </p>
            <p className="mt-2 text-sm text-slate-300">{tier.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-4">
              <Link
                href={tier.href}
                className="inline-flex w-full items-center justify-center rounded-full border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-200 hover:border-emerald-400 hover:text-white"
              >
                {tier.cta}
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-900 bg-slate-950/70 p-6">
        <h2 className="text-sm font-semibold text-slate-50">Integrations & sources</h2>
        <p className="mt-1 text-sm text-slate-300">
          We can ingest your roles directly from ATS feeds or via API, and we also surface roles from trusted boards.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
          {integrations.map((name) => (
            <span
              key={name}
              className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-900 bg-slate-950/70 p-6">
        <h2 className="text-sm font-semibold text-slate-50">
          Frequently asked questions
        </h2>
        <div className="mt-4 space-y-3 text-sm text-slate-200">
          {faqs.map((item) => (
            <div key={item.q} className="rounded-xl border border-slate-900 bg-slate-950/50 p-3">
              <p className="font-semibold text-slate-100">{item.q}</p>
              <p className="text-slate-300">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
