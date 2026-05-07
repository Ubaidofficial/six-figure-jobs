// app/company/[slug]/opengraph-image.tsx
// Dynamic Open Graph image for company profile pages.

import { ImageResponse } from 'next/og'
import { prisma } from '../../../lib/prisma'
import { buildWhere } from '../../../lib/jobs/queryJobs'

export const runtime = 'nodejs'
export const alt = 'Company jobs on Six Figure Jobs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BRAND_GREEN = '#84cc16'
const BG = '#0a0a0a'
const CARD_BG = '#111111'
const TEXT_PRIMARY = '#ffffff'
const TEXT_MUTED = '#a3a3a3'
const BORDER = '#1f1f1f'

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

async function getCompanyData(slug: string) {
  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, countryCode: true, website: true },
  })
  if (!company) return null

  const eligibleWhere = buildWhere({})
  const jobCount = await prisma.job.count({
    where: { ...eligibleWhere, companyId: company.id },
  })

  const salaryAgg = await prisma.job.aggregate({
    where: { ...eligibleWhere, companyId: company.id, currency: 'USD' },
    _avg: { minAnnual: true, maxAnnual: true },
  })

  const avgMin = Number(salaryAgg._avg.minAnnual ?? 0)
  const avgMax = Number(salaryAgg._avg.maxAnnual ?? 0)
  const avg = avgMax > 0 ? (avgMin + avgMax) / 2 : avgMin

  return { company, jobCount, avgSalary: avg > 0 ? avg : null }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getCompanyData(slug).catch(() => null)

  const name = data ? truncate(data.company.name, 40) : 'Company'
  const jobCount = data?.jobCount ?? 0
  const avgSalaryK = data?.avgSalary ? Math.round(data.avgSalary / 1000) : null
  const description = data?.company.description
    ? truncate(data.company.description, 120)
    : `${jobCount} verified $100k+ jobs with published salary ranges.`

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

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
            gap: 16,
          }}
        >
          {/* Company avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                background: '#1a1a2e',
                border: `2px solid ${BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: BRAND_GREEN,
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              {initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ color: TEXT_PRIMARY, fontSize: 42, fontWeight: 800, lineHeight: 1.1 }}>
                {name}
              </div>
              <div style={{ color: TEXT_MUTED, fontSize: 18 }}>
                {data?.company.countryCode ?? 'Global'} · Tech company
              </div>
            </div>
          </div>

          {/* Description */}
          <div style={{ color: TEXT_MUTED, fontSize: 20, lineHeight: 1.5 }}>
            {description}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            <div
              style={{
                background: `${BRAND_GREEN}18`,
                border: `1px solid ${BRAND_GREEN}40`,
                borderRadius: 100,
                color: BRAND_GREEN,
                fontSize: 16,
                fontWeight: 700,
                padding: '8px 20px',
              }}
            >
              {jobCount} open roles
            </div>
            {avgSalaryK && (
              <div
                style={{
                  background: '#3b82f618',
                  border: '1px solid #3b82f640',
                  borderRadius: 100,
                  color: '#60a5fa',
                  fontSize: 16,
                  fontWeight: 700,
                  padding: '8px 20px',
                }}
              >
                ~${avgSalaryK}k avg salary
              </div>
            )}
            <div
              style={{
                background: '#6366f118',
                border: '1px solid #6366f140',
                borderRadius: 100,
                color: '#818cf8',
                fontSize: 16,
                fontWeight: 700,
                padding: '8px 20px',
              }}
            >
              $100k+ verified
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: TEXT_MUTED, fontSize: 16 }}>sixfigurejobs.com</div>
          <div style={{ color: TEXT_MUTED, fontSize: 16 }}>Verified salaries · Direct apply</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
