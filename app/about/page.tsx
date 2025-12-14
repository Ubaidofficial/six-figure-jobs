import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About Six Figure Jobs',
  description:
    'Six Figure Jobs is a curated job board for verified $100k+ roles across remote, hybrid, and on-site opportunities worldwide.',
}

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        About Six Figure Jobs
      </h1>

      <p className="mt-5 text-base leading-7 text-slate-300">
        Six Figure Jobs helps job seekers find high-paying roles faster.
        We focus on positions that typically pay <strong>$100k+</strong> (or the
        local-market equivalent), across <strong>remote</strong>,{' '}
        <strong>hybrid</strong>, and <strong>on-site</strong> work.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        What makes us different
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-slate-300">
        <li>
          <strong>Source-linked listings:</strong> we link to the original job
          post so you can apply direct.
        </li>
        <li>
          <strong>Salary-first discovery:</strong> browse by role, location, and
          pay bands.
        </li>
        <li>
          <strong>Global coverage:</strong> not just the US—EU and other regions
          are included when companies publish salary ranges.
        </li>
        <li>
          <strong>No index bloat:</strong> we avoid creating low-value pages that
          clutter search results.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        For job seekers
      </h2>
      <p className="mt-4 text-slate-300">
        Start here: <Link className="text-emerald-300 underline" href="/jobs">browse $100k+ jobs</Link>{' '}
        or explore <Link className="text-emerald-300 underline" href="/remote">remote roles</Link>.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        For employers
      </h2>
      <p className="mt-4 text-slate-300">
        Hiring for a high-paying role? Post directly here:{' '}
        <Link className="text-emerald-300 underline" href="/post-a-job">
          Post a job
        </Link>
        .
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">Contact</h2>
      <p className="mt-4 text-slate-300">
        For support or feedback, reach us at{' '}
        <a className="text-emerald-300 underline" href="mailto:support@6figjobs.com">
          support@6figjobs.com
        </a>
        .
      </p>

      <p className="mt-10 text-sm text-slate-500">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
    </main>
  )
}
