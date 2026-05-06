import { prisma } from '../../lib/prisma'
import Link from 'next/link'

export default async function AdminDashboard() {
  const [totalJobs, activeJobs, expiredJobs, totalCompanies, newFeedback, totalFeedback, recentScrapes] =
    await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { isExpired: false } }),
      prisma.job.count({ where: { isExpired: true } }),
      prisma.company.count(),
      prisma.feedback.count({ where: { status: 'new' } }),
      prisma.feedback.count(),
      prisma.scrapeRun.findMany({ orderBy: { startedAt: 'desc' }, take: 5, select: { id: true, startedAt: true, jobsNew: true, status: true } }),
    ])

  const stats = [
    { label: 'Active Jobs', value: activeJobs.toLocaleString(), sub: `${totalJobs.toLocaleString()} total`, color: '#84cc16' },
    { label: 'Expired Jobs', value: expiredJobs.toLocaleString(), sub: 'removed from listings', color: '#f87171' },
    { label: 'Companies', value: totalCompanies.toLocaleString(), sub: 'indexed', color: '#60a5fa' },
    { label: 'New Feedback', value: newFeedback.toLocaleString(), sub: `${totalFeedback.toLocaleString()} total`, color: '#fbbf24' },
  ]

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Dashboard</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Overview of your job board</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: '#555' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Quick links */}
        <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { href: '/admin/feedback?status=new', label: `View ${newFeedback} unread feedback`, icon: '💬' },
              { href: '/admin/jobs?expired=0', label: 'Manage active jobs', icon: '💼' },
              { href: '/admin/jobs?expired=1', label: 'Review expired jobs', icon: '🗂' },
              { href: '/admin/config', label: 'Edit site copy', icon: '✏️' },
            ].map((l) => (
              <Link key={l.href} href={l.href} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: '#1a1a1a', borderRadius: 8, color: '#a3a3a3', textDecoration: 'none', fontSize: 14,
              }}>
                <span>{l.icon}</span>{l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent scrapes */}
        <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent Scrape Runs</h2>
          {recentScrapes.length === 0 ? (
            <p style={{ color: '#555', fontSize: 14 }}>No scrape runs recorded yet.</p>
          ) : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#555' }}>
                  <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>Started</th>
                  <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 600 }}>New</th>
                  <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentScrapes.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '8px 0', color: '#a3a3a3' }}>{new Date(r.startedAt).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right', color: '#84cc16' }}>{r.jobsNew}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{
                        background: r.status === 'done' ? '#1a2e1a' : r.status === 'running' ? '#1a1f2e' : '#2e1a1a',
                        color: r.status === 'done' ? '#84cc16' : r.status === 'running' ? '#60a5fa' : '#f87171',
                        borderRadius: 100, padding: '2px 8px', fontSize: 11,
                      }}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
