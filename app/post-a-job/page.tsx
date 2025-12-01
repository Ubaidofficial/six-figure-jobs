// app/post-a-job/page.tsx

import Link from 'next/link'

export const revalidate = 3600

export default function PostJobPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-10 space-y-10">
      <header className="space-y-4 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-950/70 to-slate-900 p-6 shadow-lg shadow-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Featured $100k+ job posting
            </p>
            <h1 className="text-3xl font-semibold text-slate-50">
              Post a six-figure role and reach verified $100k+ talent
            </h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Promote your $100k+ openings to senior candidates across engineering, product, data, design, and GTM. Featured posts run for 14 days, sit above standard listings, and show salary, remote/hybrid tags, and direct apply.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-200">
              <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
                14-day promoted placement
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
                Remote + hybrid eligible
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
                Salary shown to increase applies
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-right">
            <p className="text-xs text-slate-400">Featured</p>
            <p className="text-3xl font-bold text-slate-50">$99</p>
            <p className="text-xs text-slate-400">per role / 14 days</p>
            <Link
              href="/pricing"
              className="mt-3 inline-flex items-center justify-center rounded-full border border-emerald-600 px-4 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-400 hover:text-white"
            >
              View pricing
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">
              Job title*
            </label>
            <input
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              placeholder="Senior Software Engineer"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">
              Company name*
            </label>
            <input
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              placeholder="Acme Inc."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">
              Company website*
            </label>
            <input
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              placeholder="https://acme.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">
              Location (city, country) or Remote*
            </label>
            <input
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              placeholder="San Francisco, CA or Remote (US)"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">
              Salary range (local currency)*
            </label>
            <input
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              placeholder="$150,000 – $220,000 / year"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">
              Apply URL*
            </label>
            <input
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              placeholder="https://acme.com/careers/job-id"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-200">
              Job description* (brief)
            </label>
            <textarea
              rows={5}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              placeholder="Summarize responsibilities, requirements, and benefits..."
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-400">
            Featured posts are reviewed before publishing. You’ll receive a confirmation email.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled
              className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-900 opacity-80"
            >
              Start $99 featured post (checkout coming soon)
            </button>
            <Link
              href="mailto:hi@sixfigurejobs.com"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-200">
        <h2 className="text-sm font-semibold text-slate-50">
          Featured post includes
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
          <li>14-day promoted placement above standard listings</li>
          <li>Remote, hybrid, and on-site tags displayed to candidates</li>
          <li>Salary shown to increase apply intent for $100k+ talent</li>
          <li>Direct apply link; no applicant friction</li>
        </ul>
      </section>
    </main>
  )
}
