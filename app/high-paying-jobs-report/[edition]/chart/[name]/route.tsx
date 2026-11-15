// app/high-paying-jobs-report/[edition]/chart/[name]/route.tsx
//
// A chart from one edition of the pay report as a PNG (1200 x 675), for other sites to embed with a link back. Drawn from the
// same data as the page (lib/research/payReportCharts.ts). Generated at build time for every edition and chart, so a request
// costs nothing; the URL includes the edition, so an embedded chart never changes under the page that shows it.
import { ImageResponse } from 'next/og'

import { PAY_REPORT_CHART_NAMES, isChartName, payReportChart } from '@/lib/research/payReportCharts'
import { PAY_REPORT_EDITIONS, PAY_REPORT_PATH, findEdition } from '@/lib/research/payReport'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'

export const runtime = 'nodejs'
export const dynamicParams = false

const BRAND_GREEN = '#84cc16'
const BG = '#0a0a0a'
const TEXT = '#ffffff'
const MUTED = '#a3a3a3'
const TRACK = '#1f1f1f'

export function generateStaticParams() {
  return PAY_REPORT_EDITIONS.flatMap((e) => PAY_REPORT_CHART_NAMES.map((name) => ({ edition: e.slug, name })))
}

export async function GET(_req: Request, { params }: { params: Promise<{ edition: string; name: string }> }) {
  const { edition, name } = await params
  const report = findEdition(edition)
  if (!report || !isChartName(name)) return new Response('Not found', { status: 404 })
  const chart = payReportChart(report, name)
  const source = `${getSiteUrl().replace(/^https?:\/\//, '')}${PAY_REPORT_PATH}`

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 675, background: BG, color: TEXT, display: 'flex', flexDirection: 'column', padding: '48px 56px' }}>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, lineHeight: 1.1 }}>{chart.title}</div>
        <div style={{ display: 'flex', marginTop: 10, fontSize: 24, color: MUTED }}>{chart.subtitle}</div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: chart.bars.length > 6 ? 12 : 22 }}>
          {chart.bars.map((b) => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', width: 340, fontSize: 24, color: TEXT }}>{b.label}</div>
              <div style={{ display: 'flex', flex: 1, height: 30, background: TRACK, borderRadius: 6 }}>
                <div style={{ display: 'flex', width: `${Math.max(b.pct, 2)}%`, height: 30, background: BRAND_GREEN, borderRadius: 6 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: 150, fontSize: 26, fontWeight: 700 }}>{b.valueText}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: MUTED }}>
          <div style={{ display: 'flex' }}>Source: {SITE_NAME}, {report.month}</div>
          <div style={{ display: 'flex' }}>{source}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 675, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' } },
  )
}
