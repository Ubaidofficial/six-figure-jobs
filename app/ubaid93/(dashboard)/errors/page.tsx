import { ERROR_WINDOW_DAYS, loadErrorGroups } from './groups'
import ErrorGroups from './ErrorGroups'
import { PageHead, Tabs, s } from '../ui'

export const dynamic = 'force-dynamic'

type View = 'open' | 'all' | 'noise'

export default async function ErrorsPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const raw = (await searchParams)?.view
  const view: View = raw === 'all' || raw === 'noise' ? raw : 'open'
  const groups = await loadErrorGroups()

  const real = groups.filter((g) => !g.noise)
  const open = real.filter((g) => g.newCount > 0)
  const noise = groups.filter((g) => g.noise)
  const shown = view === 'open' ? open : view === 'noise' ? noise : real
  const reports = (list: typeof groups) => list.reduce((n, g) => n + g.count, 0)

  return (
    <>
      <PageHead
        title="Errors"
        lede={`JavaScript errors visitors' browsers reported in the last ${ERROR_WINDOW_DAYS} days, one row per issue. Resolve an issue once it is fixed; if it comes back, its new reports open it again.`}
      />
      <div className={s.toolbar}>
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
        groups={shown.map((g) => ({
          ...g,
          firstSeen: g.firstSeen.toISOString(),
          lastSeen: g.lastSeen.toISOString(),
        }))}
      />
    </>
  )
}
