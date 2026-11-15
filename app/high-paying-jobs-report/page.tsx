// app/high-paying-jobs-report/page.tsx
//
// The monthly Six-Figure Job Pay Report: advertised pay in the six-figure listings we collect, by band, seniority, role,
// work arrangement, city and employer, with the method and its limits. One permanent URL that always shows the latest
// edition (see lib/research/payReport.ts), so the links it earns build up on one page; each edition also has a dated address
// (/high-paying-jobs-report/2026-11, ./[edition]/page.tsx). It is research, not a listing page: the head search "high paying
// jobs" belongs to /high-paying-jobs, which this page links to and does not compete with.
import type { Metadata } from 'next'

import { PayReportView } from '@/components/research/PayReportView'
import { PAY_REPORT } from '@/lib/research/payReport'
import { payReportMetadata } from '@/lib/research/payReportMetadata'

export const metadata: Metadata = payReportMetadata(PAY_REPORT)

export default function PayReportPage() {
  return <PayReportView report={PAY_REPORT} />
}
