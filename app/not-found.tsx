// app/not-found.tsx
import Link from '@/components/ui/Link'

export default function NotFound() {
  return (
    <main className="min-h-[60vh] bg-card text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">
          404 — Job not found
        </p>

        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          This job is no longer available
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          It may have expired or been removed from the company&apos;s ATS.
          You can still browse other $100k+ roles by location, role,
          or company.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <Link
            href="/jobs/100k-plus"
            className="rounded-full bg-sky-500 px-5 py-2 font-semibold text-primary-foreground hover:bg-sky-400"
          >
            View all $100k+ jobs
          </Link>
          <Link
            href="/"
            className="rounded-full border border-border px-5 py-2 text-foreground hover:border-foreground/40"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
