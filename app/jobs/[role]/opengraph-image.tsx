// app/jobs/[role]/opengraph-image.tsx
// Dynamic Open Graph image for role hub pages (/jobs/[role]).

import { ImageResponse } from 'next/og'
import { prisma } from '../../../lib/prisma'
import { buildWhere } from '../../../lib/jobs/queryJobs'
import { SEARCH_ROLE_OPTIONS } from '../../../lib/roles/searchRoles'

export const runtime = 'nodejs'
export const alt = 'Role jobs on Six Figure Jobs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BRAND_GREEN = '#84cc16'
const BG = '#0a0a0a'
const CARD_BG = '#111111'
const TEXT_PRIMARY = '#ffffff'
const TEXT_MUTED = '#a3a3a3'
const BORDER = '#1f1f1f'

function toTitleCase(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

async function getRoleData(roleSlug: string) {
  const where = buildWhere({ roleSlugs: [roleSlug] })
  const [total, agg] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.aggregate({
      where: { ...where, currency: 'USD' },
      _avg: { minAnnual: true, maxAnnual: true },
    }),
  ])

  const avgMin = Number(agg._avg.minAnnual ?? 0)
  const avgMax = Number(agg._avg.maxAnnual ?? 0)
  const avg = avgMax > 0 ? (avgMin + avgMax) / 2 : avgMin

  return { total, avgSalary: avg > 0 ? avg : null }
}

export default async function Image({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params

  const roleOpt = SEARCH_ROLE_OPTIONS.find((r) => r.slug === role)
  const roleTitle = roleOpt?.label ?? toTitleCase(role)
  const emoji = roleOpt?.emoji ?? '💼'

  const data = await getRoleData(role).catch(() => ({ total: 0, avgSalary: null }))
  const avgSalaryK = data.avgSalary ? Math.round(data.avgSalary / 1000) : null

  const salaryBands = [
    { label: '$100k–$150k', color: '#3b82f6' },
    { label: '$150k–$200k', color: '#8b5cf6' },
    { label: '$200k+', color: BRAND_GREEN },
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: BG,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              background: BRAND_GREEN,
              borderRadius: 8,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ color: '#000', fontSize: 20, fontWeight: 800 }}>$</div>
          </div>
          <div style={{ color: TEXT_MUTED, fontSize: 18, fontWeight: 600 }}>Six Figure Jobs</div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              background: '#1a2e1a',
              border: `1px solid ${BRAND_GREEN}40`,
              borderRadius: 100,
              color: BRAND_GREEN,
              fontSize: 14,
              fontWeight: 700,
              padding: '6px 16px',
            }}
          >
            Role Hub
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: '40px 48px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 56 }}>{emoji}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  color: TEXT_PRIMARY,
                  fontSize: 48,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}
              >
                {roleTitle}
              </div>
              <div style={{ color: TEXT_MUTED, fontSize: 20 }}>
                $100k+ jobs with verified salary ranges
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div
              style={{
                background: `${BRAND_GREEN}18`,
                border: `1px solid ${BRAND_GREEN}40`,
                borderRadius: 100,
                color: BRAND_GREEN,
                fontSize: 18,
                fontWeight: 700,
                padding: '10px 24px',
              }}
            >
              {data.total.toLocaleString()} open roles
            </div>
            {avgSalaryK && (
              <div
                style={{
                  background: '#3b82f618',
                  border: '1px solid #3b82f640',
                  borderRadius: 100,
                  color: '#60a5fa',
                  fontSize: 18,
                  fontWeight: 700,
                  padding: '10px 24px',
                }}
              >
                ~${avgSalaryK}k avg (USD)
              </div>
            )}
            {salaryBands.map((band) => (
              <div
                key={band.label}
                style={{
                  background: `${band.color}18`,
                  border: `1px solid ${band.color}40`,
                  borderRadius: 100,
                  color: band.color,
                  fontSize: 15,
                  fontWeight: 600,
                  padding: '10px 20px',
                }}
              >
                {band.label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: TEXT_MUTED, fontSize: 16 }}>sixfigurejobs.com</div>
          <div style={{ color: TEXT_MUTED, fontSize: 16 }}>Remote · On-site · Hybrid — all in one place</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
