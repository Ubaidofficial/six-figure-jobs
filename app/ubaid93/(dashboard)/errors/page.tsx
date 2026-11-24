import { ERROR_WINDOW_DAYS, loadErrorGroups } from './groups'
import ErrorGroups from './ErrorGroups'
import { TrendChart } from '../charts'
import { PageHead, Section, Tabs, ago, lastDays, s } from '../ui'
import { requireAdmin } from '../requireAdmin'

export const dynamic = 'force-dynamic'

type View = 'open' | 'all' | 'noise'

export default async function ErrorsPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  await requireAdmin()
  const raw = (await searchParams)?.view
  const view: View = raw === 'all' || raw === 'noise' ? raw : 'open'
  const days = lastDays(ERROR_WINDOW_DAYS)
  const groups = await loadErrorGroups(days)

  const real = groups.filter((g) => !g.noise)
  const open = real.filter((g) => g.newCount > 0)
  const noise = groups.filter((g) => g.noise)
  const shown = view === 'open' ? open : view === 'noise' ? noise : real
  const reports = (list: typeof groups) => list.reduce((n, g) => n + g.count, 0)
  const perDay = days.map((_, i) => real.reduce((n, g) => n + g.daily[i], 0))

  return (
    <>
      <PageHead
        title="Errors"
        lede={`JavaScript errors visitors' browsers reported in the last ${ERROR_WINDOW_DAYS} days, one row per issue. Resolve an issue once it is fixed; if it comes back, its new reports open it again.`}
      />
      <Section title="Reports per day" note="all issues except browser noise, complete UTC days">
        <div className={`${s.panel} ${s.panelPad}`}>
          <TrendChart label="Error reports per day" days={days.slice(0, -1)} height={150} series={[{ label: 'reports', values: perDay.slice(0, -1), kind: 'column' }]} />
        </div>
      </Section>
      <div className={s.toolbar} style={{ marginTop: 20 }}>
        <Tabs
          current={view}
          items={[
            { label: 'Open', value: 'open', href: '/ubaid93/errors', count: open.length },
            { label: 'All issues', value: 'all', href: '/ubaid93/errors?view=all', count: real.length },
            { label: 'Browser noise', value: 'noise', href: '/ubaid93/errors?view=noise', count: noise.length },
          ]}
        />
      </div>
      <ErrorGroups
        view={view}
        reportCount={reports(shown)}
        groups={shown.map(({ ids, daily, firstSeen, lastSeen, ...g }) => ({
          ...g,
          // The last 14 complete days: today's partial count would read as a drop.
          recent: daily.slice(-15, -1),
          firstSeenAgo: ago(firstSeen),
          lastSeenAgo: ago(lastSeen),
        }))}
      />
    </>
  )
}
