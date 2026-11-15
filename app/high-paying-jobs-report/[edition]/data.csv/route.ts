// app/high-paying-jobs-report/[edition]/data.csv/route.ts
//
// Every table of one edition of the pay report as a CSV file (lib/research/payReport.ts: payReportCsv), so a journalist or
// analyst can check a figure or chart it without retyping it from the page.
import { PAY_REPORT_EDITIONS, findEdition, payReportCsv } from '@/lib/research/payReport'

export const dynamicParams = false

export function generateStaticParams() {
  return PAY_REPORT_EDITIONS.map((e) => ({ edition: e.slug }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ edition: string }> }) {
  const { edition } = await params
  const report = findEdition(edition)
  if (!report) return new Response('Not found', { status: 404 })
  return new Response(payReportCsv(report), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="six-figure-job-pay-report-${report.slug}.csv"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
