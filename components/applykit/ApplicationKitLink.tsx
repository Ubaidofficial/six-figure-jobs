import Link from '@/components/ui/Link'

// Renders nothing unless accounts were switched on when the site was built (next.config.js inlines the flag), so with
// accounts off the job page HTML is exactly what it was. It is a plain link to a private, noindex page: nofollow, no prefetch.
const ENABLED = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === 'true'

export function ApplicationKitLink({ slug }: { slug: string }) {
  if (!ENABLED) return null
  return (
    <Link
      href={`/account/kit/${encodeURIComponent(slug)}`}
      prefetch={false}
      rel="nofollow"
      className="block rounded-lg border border-border px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-muted"
    >
      Write a cover letter for this job
    </Link>
  )
}
