import Link from 'next/link'

import { prisma } from '../../../lib/prisma'
import { JOB_REPORT_TYPES, reportedJobId } from '../../../lib/admin/jobReports'
import { countReviewQueue } from '../../../lib/admin/reviewQueue'
import { countNewErrorGroups } from './errors/groups'
import { loadDaily, loadHealthChecks } from './overview'
import { TrendChart } from './charts'
import { Figures, PageHead, Section, Status, lastDays, s } from './ui'
import { BarList, SplitBar, movingAverage } from './visuals'
import { requireAdmin } from './requireAdmin'

export const dynamic = 'force-dynamic'

const DAY = 86_400_000

export default async function AdminOverview() {
  await requireAdmin()
  const now = Date.now()
  const days = lastDays(30)
  const since24h = new Date(now - DAY)
  const since7d = new Date(now - 7 * DAY)

  const [checks, daily, live, added24h, expired24h, clicks7d, newFeedback, openIssues, activeAlerts, modes, countries] = await Promise.all([
    loadHealthChecks(now),
    loadDaily(days),
    prisma.job.count({ where: { isExpired: false } }),
    // "isExpired" IN (true, false) lets Postgres use the (isExpired, createdAt) index instead of reading every job.
    prisma.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM "Job" WHERE "isExpired" IN (true, false) AND "createdAt" >= ${since24h}`.then(
      (r) => Number(r[0]?.n ?? 0),
    ),
    prisma.job.count({ where: { isExpired: true, validThrough: { gte: since24h } } }),
    prisma.applyClick.count({ where: { createdAt: { gte: since7d } } }).catch(() => 0),
    prisma.feedback.count({ where: { status: 'new' } }),
    countNewErrorGroups().catch(() => 0),
    prisma.$queryRaw<Array<{ n: number }>>`SELECT count(DISTINCT lower(email))::int AS n FROM "JobAlert" WHERE status = 'active'`
      .then((r) => Number(r[0]?.n ?? 0))
      .catch(() => 0),
    prisma.job.groupBy({ by: ['remoteMode'], where: { isExpired: false }, _count: { _all: true } }),
    prisma.job.groupBy({
      by: ['countryCode'],
      where: { isExpired: false, countryCode: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { countryCode: 'desc' } },
      take: 6,
    }),
  ])
  const [review, openReports] = await Promise.all([
    countReviewQueue({ cached: true }).catch(() => ({ pay: 0, titles: 0 })),
    prisma.feedback
      .findMany({ where: { type: { in: JOB_REPORT_TYPES }, status: { not: 'resolved' } }, select: { type: true, message: true }, take: 5000 })
      .catch(() => []),
  ])
  const reportedJobs = new Set(openReports.map((r) => reportedJobId(r.type, r.message)).filter(Boolean)).size

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  // Live jobs at the end of each day, walked back from today: minus the jobs added after that day, plus the ones
  // expired after it. Close enough for a trend (a job reopened after expiry is counted once).
  const liveByDay = days.map((_, i) => live - sum(daily.added.slice(i + 1)) + sum(daily.expired.slice(i + 1)))
  const last14 = (a: number[]) => a.slice(-14)
  // Flows (added, expired, clicks) are charted over complete days only: today's partial count would look like a drop.
  const full = days.slice(0, -1)
  const modeCount = (m: string | null) => modes.filter((r) => r.remoteMode === m).reduce((n, r) => n + r._count._all, 0)
  const known = ['remote', 'hybrid', 'onsite']
  const notStated = modes.filter((r) => !known.includes(r.remoteMode ?? '')).reduce((n, r) => n + r._count._all, 0)
  const todo = [
    newFeedback > 0 && { href: '/ubaid93/feedback?status=new', text: `${newFeedback} new feedback message${newFeedback === 1 ? '' : 's'}` },
    openIssues > 0 && { href: '/ubaid93/errors', text: `${openIssues} open error issue${openIssues === 1 ? '' : 's'}` },
    reportedJobs > 0 && { href: '/ubaid93/feedback?kind=reports', text: `${reportedJobs} job${reportedJobs === 1 ? '' : 's'} reported by visitors` },
    review.pay > 0 && { href: '/ubaid93/review', text: `${review.pay.toLocaleString()} job${review.pay === 1 ? '' : 's'} with pay over $600k to check` },
    review.titles > 0 && { href: '/ubaid93/review?kind=titles', text: `${review.titles.toLocaleString()} job${review.titles === 1 ? '' : 's'} with odd titles` },
    // Red checks only: amber ones are visible in the Health panel beside this list.
    ...checks.filter((c) => c.tone === 'bad').map((c) => ({ href: c.href ?? '/ubaid93/system', text: c.todo ?? `${c.label}: ${c.state}` })),
  ].filter(Boolean) as Array<{ href: string; text: string }>

  return (
    <>
      <PageHead title="Overview" lede="Whether the site is taking in and removing jobs as it should, and what needs a look." />

      <Figures
        items={[
          { label: 'Jobs not expired', value: live.toLocaleString(), sub: 'the site lists those that pass its quality rules', spark: last14(liveByDay) },
          { label: 'Added, 24 h', value: added24h.toLocaleString(), sub: `${sum(last14(daily.added)).toLocaleString()} in 14 days`, spark: last14(daily.added) },
          { label: 'Expired, 24 h', value: expired24h.toLocaleString(), sub: `${sum(last14(daily.expired)).toLocaleString()} in 14 days`, spark: last14(daily.expired) },
          { label: 'Apply clicks, 7 days', value: clicks7d.toLocaleString(), sub: `${sum(last14(daily.clicks)).toLocaleString()} in 14 days`, spark: last14(daily.clicks) },
          { label: 'Alert subscribers', value: activeAlerts.toLocaleString(), sub: 'unique confirmed emails' },
        ]}
      />

      <div className={s.grid2} style={{ marginTop: 16 }}>
        <Section title="Health">
          <ul className={`${s.panel} ${s.checks}`}>
            {checks.map((c) => (
              <li key={c.label} className={s.check}>
                <span className={s.checkLabel}>{c.label}</span>
                <div>
                  <Status tone={c.tone}>{c.state}</Status>
                  {c.detail ? <div className={s.checkNote}>{c.detail}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Needs a look">
          <div className={s.panel}>
            {todo.length === 0 ? (
              <p className={s.empty}>Nothing waiting.</p>
            ) : (
              <ul className={s.checks}>
                {todo.map((t) => (
                  <li key={t.text} className={s.check} style={{ gridTemplateColumns: '1fr' }}>
                    <Link href={t.href} className={s.link}>
                      {t.text}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      </div>

      <div className={s.grid2}>
        <Section title="Jobs not expired" note="end of each UTC day, 30 days">
          <div className={`${s.panel} ${s.panelPad}`}>
            <TrendChart label="Jobs not expired at the end of each day" days={days} series={[{ label: 'not expired', values: liveByDay, area: true }]} />
          </div>
        </Section>
        <Section title="Jobs added and expired" note="per complete UTC day">
          <div className={`${s.panel} ${s.panelPad}`}>
            <TrendChart
              label="Jobs added and expired per day"
              days={full}
              series={[
                { label: 'added', values: daily.added.slice(0, -1) },
                { label: 'expired', values: daily.expired.slice(0, -1) },
              ]}
            />
          </div>
        </Section>
      </div>

      <div className={s.grid2}>
        <Section title="Apply clicks" note="per complete UTC day, with the 7-day average">
          <div className={`${s.panel} ${s.panelPad}`}>
            <TrendChart
              label="Apply clicks per day and their 7-day average"
              days={full}
              series={[
                { label: 'clicks', values: daily.clicks.slice(0, -1), kind: 'column', color: '#b7d3f6' },
                { label: '7-day average', values: movingAverage(daily.clicks.slice(0, -1)), color: '#2a78d6' },
              ]}
            />
          </div>
        </Section>
        <Section title="Where the jobs are" note="jobs not expired">
          <div className={s.panel}>
            <div className={s.panelPad}>
              <div className={s.figureLabel} style={{ marginBottom: 8 }}>Work arrangement</div>
              <SplitBar
                parts={[
                  { label: 'Remote', value: modeCount('remote'), color: '#2a78d6' },
                  { label: 'Hybrid', value: modeCount('hybrid'), color: '#eb6834' },
                  { label: 'On-site', value: modeCount('onsite'), color: '#1baf7a' },
                  { label: 'Not stated', value: notStated, color: '#c3c2b7' },
                ]}
              />
            </div>
            <div className={s.figureLabel} style={{ padding: '4px 18px 0' }}>Top countries</div>
            <BarList items={countries.map((c) => ({ label: c.countryCode ?? '', value: c._count._all }))} total={live} />
          </div>
        </Section>
      </div>
    </>
  )
}
