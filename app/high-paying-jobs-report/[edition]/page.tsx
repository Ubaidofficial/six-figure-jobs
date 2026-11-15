// app/high-paying-jobs-report/[edition]/page.tsx
//
// One edition of the pay report at its own, permanent address (/high-paying-jobs-report/2026-11): the figures as published,
// so a link or a citation keeps showing what it quoted. While an edition is the latest, its canonical is the permanent page
// (same content, one indexed URL); once a newer edition exists, it canonicalises to itself and joins the sitemap.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PayReportView } from '@/components/research/PayReportView'
import { PAY_REPORT_EDITIONS, findEdition } from '@/lib/research/payReport'
import { payReportMetadata } from '@/lib/research/payReportMetadata'

export const dynamicParams = false

export function generateStaticParams() {
  return PAY_REPORT_EDITIONS.map((e) => ({ edition: e.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ edition: string }> }): Promise<Metadata> {
  const report = findEdition((await params).edition)
  return report ? payReportMetadata(report) : {}
}

export default async function PayReportEditionPage({ params }: { params: Promise<{ edition: string }> }) {
  const report = findEdition((await params).edition)
  if (!report) notFound()
  return <PayReportView report={report} />
}
