// lib/seo/jobMeta.ts

import type { Metadata } from 'next'
import type { Job, Company } from '@prisma/client'

export type JobWithCompany = Job & { companyRef: Company | null }

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

export function buildJobMetadata(job: JobWithCompany): Metadata {
  const companyName = job.companyRef?.name || job.company
  const salary = buildSalary(job)
  const location = job.remote
    ? 'Remote'
    : buildLocation(job) || 'Location not specified'

  const title = salary
    ? `${job.title} at ${companyName} — ${salary} | Remote100k`
    : `${job.title} at ${companyName} | Remote100k`

  const description = `Apply for ${job.title} at ${companyName}. ${
    job.type || 'Role'
  } paying ${salary || '100k+ base compensation'}. ${
    job.remote ? 'Remote options available.' : ''
  } Location: ${location}`

  const path = `/job/${job.id}`

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}${path}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      siteName: 'Remote100k',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

/* helpers */

function buildSalary(job: any): string | null {
  const min =
    job.minAnnual != null ? Number(job.minAnnual) : null
  const max =
    job.maxAnnual != null ? Number(job.maxAnnual) : null
  const sym =
    job.currency === 'USD' || !job.currency
      ? '$'
      : job.currency + ' '

  const fmt = (v: number) => `${Math.round(v / 1000)}k`

  if (min && max) return `${sym}${fmt(min)}–${fmt(max)}/yr`
  if (min) return `${sym}${fmt(min)}+/yr`
  return null
}

function buildLocation(job: any): string | null {
  if (job.city && job.countryCode)
    return `${job.city}, ${job.countryCode}`
  if (job.countryCode) return job.countryCode
  if (job.locationRaw) return job.locationRaw
  return null
}
