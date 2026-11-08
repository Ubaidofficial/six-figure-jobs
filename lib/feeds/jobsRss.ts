// lib/feeds/jobsRss.ts
// Public RSS 2.0 feeds of the newest $100k+ jobs (/feeds/jobs.rss, /feeds/remote-jobs.rss), for feed readers,
// aggregators and newsletters. Each item links to the job's page on this site; title "Company: Job title", like the
// big remote boards, with pay, location and work arrangement in the description.
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'
import { describeJobLocation } from '@/lib/location/jobLocation'

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const WORK_MODE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', 'on-site': 'On-site' }

export function buildJobsRss(
  jobs: JobWithCompany[],
  { siteUrl, title, description, selfPath }: { siteUrl: string; title: string; description: string; selfPath: string },
): string {
  const items = jobs.map((job) => {
    const company = String(job.companyRef?.name ?? job.company ?? '').trim() || 'A hiring company'
    const url = `${siteUrl}${buildJobSlugHref(job)}`
    const pay = buildSalaryText(job)
    const where = describeJobLocation(job)
    // Remote jobs already read "Remote · <scope>" in the location; others get Hybrid / On-site when known.
    const mode = where.remote ? null : WORK_MODE[String(job.remoteMode ?? '').toLowerCase()] ?? null
    const facts = [pay, where.compact ?? where.text, mode].filter(Boolean).join(' · ')
    const date = job.postedAt ?? job.createdAt ?? job.updatedAt
    return [
      '    <item>',
      `      <title>${escapeXml(`${company}: ${job.title}`)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      date ? `      <pubDate>${new Date(date).toUTCString()}</pubDate>` : null,
      `      <description>${escapeXml(facts)}</description>`,
      '    </item>',
    ]
      .filter(Boolean)
      .join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    '    <language>en</language>',
    '    <ttl>60</ttl>',
    `    <atom:link href="${escapeXml(`${siteUrl}${selfPath}`)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
