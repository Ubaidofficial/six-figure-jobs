import Link from 'next/link'

import { prisma } from '../../../lib/prisma'
import { countNewErrorGroups } from './errors/groups'
import { loadDaily, loadHealthChecks } from './overview'
import { DailyBars, Figures, PageHead, Section, Status, lastDays, s } from './ui'

export const dynamic = 'force-dynamic'

const DAY = 86_400_000

export default async function AdminOverview() {
  const now = Date.now()
  const days = lastDays(14)
  const since24h = new Date(now - DAY)
  const since7d = new Date(now - 7 * DAY)

  const [checks, daily, live, added24h, expired24h, companies, clicks7d, newFeedback, openIssues, activeAlerts] = await Promise.all([
    loadHealthChecks(now),
    loadDaily(days),
    prisma.job.count({ where: { isExpired: false } }),
    prisma.job.count({ where: { createdAt: { gte: since24h } } }),
    prisma.job.count({ where: { isExpired: true, validThrough: { gte: since24h } } }),
    prisma.company.count(),
    prisma.applyClick.count({ where: { createdAt: { gte: since7d } } }).catch(() => 0),
    prisma.feedback.count({ where: { status: 'new' } }),
    countNewErrorGroups().catch(() => 0),
    prisma.jobAlert.count({ where: { status: 'active' } }).catch(() => 0),
  ])

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const todo = [
    newFeedback > 0 && { href: '/ubaid93/feedback?status=new', text: `${newFeedback} new feedback message${newFeedback === 1 ? '' : 's'}` },
    openIssues > 0 && { href: '/ubaid93/errors', text: `${openIssues} open error issue${openIssues === 1 ? '' : 's'}` },
    ...checks.filter((c) => c.tone === 'bad' || c.tone === 'warn').map((c) => ({ href: c.href ?? '/ubaid93/system', text: `${c.label}: ${c.state}` })),
  ].filter(Boolean) as Array<{ href: string; text: string }>

  return (
    <>
      <PageHead title="Overview" lede="Whether the site is taking in and removing jobs as it should, and what needs a look." />

      <Figures
        items={[
          { label: 'Live jobs', value: live.toLocaleString(), sub: `${companies.toLocaleString()} companies` },
          { label: 'Added, 24 h', value: added24h.toLocaleString(), sub: `${sum(daily.added).toLocaleString()} in 14 days` },
          { label: 'Expired, 24 h', value: expired24h.toLocaleString(), sub: `${sum(daily.expired).toLocaleString()} in 14 days` },
          { label: 'Apply clicks, 7 days', value: clicks7d.toLocaleString(), sub: `${sum(daily.clicks).toLocaleString()} in 14 days` },
          { label: 'Alert subscribers', value: activeAlerts.toLocaleString(), sub: 'confirmed, active' },
        ]}
      />

      <div className={s.grid2} style={{ marginTop: 16 }}>
        <Section title="Health">
          <ul className={`${s.panel} ${s.checks}`}>
            {checks.map((c) => (
              <li key={c.label} className={s.check}>
                <span className={s.checkLabel}>{c.label}</span>
                <span>
                  <Status tone={c.tone}>{c.state}</Status>
                  {c.detail ? <span className={s.checkDetail}>{c.detail}</span> : null}
                </span>
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
        <Section
          title="Jobs per day"
          note={
            <span className={s.legend}>
              <span>
                <span className={s.legendSwatch} style={{ background: 'var(--color-text-0)' }} />
                added
              </span>
              <span>
                <span className={s.legendSwatch} style={{ background: 'var(--color-text-3)', opacity: 0.45 }} />
                expired
              </span>
            </span>
          }
        >
          <div className={`${s.panel} ${s.panelPad}`}>
            <DailyBars days={days} series={[daily.expired, daily.added]} labels={['expired', 'added']} />
          </div>
        </Section>
        <Section title="Apply clicks per day" note="UTC days">
          <div className={`${s.panel} ${s.panelPad}`}>
            <DailyBars days={days} series={[daily.clicks]} labels={['clicks']} />
          </div>
        </Section>
      </div>
    </>
  )
}
