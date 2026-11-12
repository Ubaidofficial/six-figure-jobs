// The page every alert email links to: confirm the alert, switch daily/weekly, unsubscribe or subscribe again.
// The token in the URL is the only key, so the page is never indexed and sends no Referer to the links on it.
// Actions are buttons (POST), never plain links: mail scanners open every link in an email, and a GET that confirmed
// or unsubscribed would be triggered by them.
import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { notFound } from 'next/navigation'

import { alertsEnabled } from '@/lib/alerts/config'
import { buildAlertLabel, sanitizeAlertFilters } from '@/lib/alerts/filters'
import { findAlertByToken, searchUrlFor } from '@/lib/alerts/service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your job alert',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

const DONE: Record<string, string> = {
  confirm: 'Your alert is on.',
  daily: 'You will now get this alert daily.',
  weekly: 'You will now get this alert weekly.',
  unsubscribe: 'You are unsubscribed. No more emails will be sent for this alert.',
}

const button =
  'inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2'
const primary = `${button} bg-lime-500 text-neutral-950 hover:bg-lime-400`
const secondary = `${button} border border-border text-foreground hover:bg-muted`

export default async function AlertPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ done?: string }>
}) {
  if (!alertsEnabled()) notFound()
  const { token } = await params
  const alert = await findAlertByToken(token).catch(() => null)
  if (!alert) notFound()

  const filters = sanitizeAlertFilters(alert.filters) ?? {}
  const label = buildAlertLabel(filters)
  const done = DONE[(await searchParams)?.done ?? '']
  const action = `/api/alerts/${alert.token}`
  const Action = ({ value, children, kind = secondary }: { value: string; children: string; kind?: string }) => (
    <form method="post" action={action}>
      <input type="hidden" name="action" value={value} />
      <button type="submit" className={kind}>
        {children}
      </button>
    </form>
  )

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <p className="text-sm text-muted-foreground">Job alert</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{label}</h1>

      {done ? (
        <p role="status" className="mt-6 rounded-lg border border-border bg-muted px-4 py-3 text-foreground">
          {done}
        </p>
      ) : null}

      {alert.status === 'pending' ? (
        <section className="mt-8">
          <p className="text-muted-foreground">Confirm to start getting new matching jobs by email, {alert.frequency}.</p>
          <div className="mt-4">
            <Action value="confirm" kind={primary}>
              Confirm alert
            </Action>
          </div>
        </section>
      ) : alert.status === 'unsubscribed' ? (
        <section className="mt-8">
          <p className="text-muted-foreground">This alert is off.</p>
          <div className="mt-4">
            <Action value="confirm">Subscribe again</Action>
          </div>
        </section>
      ) : (
        <section className="mt-8 space-y-6">
          <div>
            <h2 className="font-semibold text-foreground">How often</h2>
            <p className="mt-1 text-muted-foreground">
              Now: <strong>{alert.frequency}</strong>. Emails only go out when there are new matching jobs.
            </p>
            <div className="mt-3 flex gap-3">
              <Action value={alert.frequency === 'daily' ? 'weekly' : 'daily'}>
                {alert.frequency === 'daily' ? 'Switch to weekly' : 'Switch to daily'}
              </Action>
            </div>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Stop this alert</h2>
            <div className="mt-3">
              <Action value="unsubscribe">Unsubscribe</Action>
            </div>
          </div>
        </section>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        <Link className="underline" href={searchUrlFor(filters)}>
          See matching jobs now
        </Link>
      </p>
    </main>
  )
}
