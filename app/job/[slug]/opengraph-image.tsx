// app/job/[slug]/opengraph-image.tsx
// Dynamic Open Graph image for individual job pages.
// 1200×630 — works on Twitter, LinkedIn, Slack, iMessage.

import { ImageResponse } from 'next/og'
import { prisma } from '../../../lib/prisma'
import { parseJobSlugParam } from '../../../lib/jobs/jobSlug'

export const runtime = 'nodejs'
export const alt = 'Job listing on Six Figure Jobs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BRAND_GREEN = '#84cc16'
const BG = '#0a0a0a'
const CARD_BG = '#111111'
const TEXT_PRIMARY = '#ffffff'
const TEXT_MUTED = '#a3a3a3'
const BORDER = '#1f1f1f'

function fmtSalary(min: bigint | null, max: bigint | null, currency: string | null): string | null {
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'AUD' ? 'A$' : currency === 'CAD' ? 'C$' : '$'
  const fmt = (n: bigint) => {
    const k = Number(n) / 1000
    return k >= 1 ? `${sym}${Math.round(k)}k` : `${sym}${Number(n)}`
  }
  if (min && max) return `${fmt(min)} – ${fmt(max)}/yr`
  if (min) return `${fmt(min)}+/yr`
  if (max) return `Up to ${fmt(max)}/yr`
  return null
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

async function getJob(slug: string) {
  const parsed = parseJobSlugParam(slug)
  const ors: any[] = []
  if (parsed.jobId) ors.push({ id: parsed.jobId })
  if (parsed.externalId) ors.push({ externalId: parsed.externalId })
  if (parsed.shortId) ors.push({ shortId: parsed.shortId })
  if (ors.length === 0) return null
  return prisma.job.findFirst({
    where: ors.length === 1 ? { ...ors[0], isExpired: false } : { OR: ors, isExpired: false },
    include: { companyRef: true },
  })
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const job = await getJob(slug).catch(() => null)

  const title = job ? truncate(job.title, 60) : 'Six Figure Jobs'
  const company = job
    ? truncate(job.companyRef?.name ?? (job as any).company ?? 'Company', 40)
    : '$100k+ Tech Jobs'
  const salary = job ? fmtSalary((job as any).minAnnual ?? null, (job as any).maxAnnual ?? null, job.currency ?? null) : null
  const location =
    job?.remoteMode === 'remote' || job?.remote
      ? 'Remote'
      : job?.city && job?.countryCode
        ? `${job.city}, ${job.countryCode}`
        : job?.countryCode ?? null

  const tags = [
    salary ? { label: salary, color: BRAND_GREEN } : null,
    location ? { label: location, color: '#3b82f6' } : null,
    job?.type ? { label: job.type, color: '#6366f1' } : null,
  ].filter(Boolean) as { label: string; color: string }[]

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
            $100k+ Verified
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
          <div style={{ color: TEXT_MUTED, fontSize: 20, fontWeight: 600 }}>
            {company}
          </div>
          <div
            style={{
              color: TEXT_PRIMARY,
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>

          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {tags.map((tag) => (
                <div
                  key={tag.label}
                  style={{
                    background: `${tag.color}18`,
                    border: `1px solid ${tag.color}40`,
                    borderRadius: 100,
                    color: tag.color,
                    fontSize: 16,
                    fontWeight: 700,
                    padding: '8px 20px',
                  }}
                >
                  {tag.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: TEXT_MUTED, fontSize: 16 }}>sixfigurejobs.com</div>
          <div style={{ color: TEXT_MUTED, fontSize: 16 }}>Direct apply · Verified salary · No recruiter spam</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
