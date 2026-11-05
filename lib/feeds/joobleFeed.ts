// lib/feeds/joobleFeed.ts
//
// XML job feed in Jooble's format. Spec used: Jooble's "XML feed specifications" PDF (document dated 2015, copy
// hosted by Matador Jobs; Jooble's own copy is gone). Root <jobs>, one <job id="..."> per job, every value in CDATA,
// required <link> <name> <region> <description> <pubdate>, plus <updated> <salary> <company> <expire> <jobtype>;
// dates as DD.MM.YYYY; Jooble indexes only jobs published or updated in the last 45 days. Confirm against the
// current spec with xml_support@jooble.com before relying on it.

import { buildJobSlug } from '../jobs/jobSlug'
import { cleanJobDescriptionText, decodeJobHtmlEntities } from '../jobs/descriptionCleaning'
import { buildSalaryText } from '../jobs/salary'

export type JoobleJob = {
  id: string
  title: string
  company: string | null
  locationRaw: string | null
  remote: boolean | null
  remoteMode: string | null
  descriptionHtml: string | null
  employmentType: string | null
  postedAt: Date | null
  createdAt: Date
  updatedAt: Date | null
  validThrough: Date | null
  minAnnual: unknown
  maxAnnual: unknown
  currency: string | null
  salaryMin?: unknown
  salaryMax?: unknown
  salaryCurrency?: string | null
}

const MAX_DESCRIPTION_CHARS = 50_000
const MAX_AGE_DAYS = 45

const JOB_TYPES: Record<string, string> = {
  'full-time': 'full-time',
  fulltime: 'full-time',
  'part-time': 'part-time',
  parttime: 'part-time',
  contract: 'contract',
  contractor: 'contract',
  temporary: 'temporary',
  internship: 'internship',
}

/** Wraps text in CDATA, removing characters XML 1.0 forbids and splitting any "]]>" inside the text. */
export function cdata(text: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  return `<![CDATA[${clean.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

/** DD.MM.YYYY in UTC, as Jooble requires. */
export function formatJoobleDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getUTCFullYear()}`
}

export function joobleJobType(employmentType: string | null | undefined): string | null {
  const key = String(employmentType ?? '').trim().toLowerCase()
  return JOB_TYPES[key] ?? null
}

/** Plain text with paragraph and list breaks kept; '' when the existing noise gate rejects the description. */
export function descriptionToText(html: string): string {
  const text = decodeJobHtmlEntities(
    String(html ?? '')
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div|\/ul|\/ol|\/tr)[^>]*>/gi, '\n')
      .replace(/<\/t[dh]>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return cleanJobDescriptionText(text) ? text : ''
}

function region(job: JoobleJob): string {
  const loc = String(job.locationRaw ?? '').trim()
  const remote = job.remote === true || job.remoteMode === 'remote'
  if (loc && remote && !/remote/i.test(loc)) return `${loc}, Remote`
  return loc || (remote ? 'Remote' : '')
}

/** One <job> element, or null when a required field is missing (the spec requires a complete description). */
export function buildJoobleJobXml(job: JoobleJob, siteUrl: string, now: number = Date.now()): string | null {
  const name = job.title?.trim()
  const reg = region(job)
  const description = descriptionToText(job.descriptionHtml ?? '').slice(0, MAX_DESCRIPTION_CHARS).trim()
  const published = job.postedAt ?? job.createdAt
  if (!name || !reg || !description || !published) return null

  // Jooble drops jobs older than 45 days (by <updated> / <pubdate>), so do not send them.
  const newest = Math.max(published.getTime(), job.updatedAt?.getTime() ?? 0)
  if (now - newest > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return null

  const link = `${siteUrl}/job/${buildJobSlug({ id: job.id, title: job.title })}`
  const salary = buildSalaryText(job as Parameters<typeof buildSalaryText>[0])
  const type = joobleJobType(job.employmentType)

  const lines = [
    `    <job id="${job.id.replace(/[^A-Za-z0-9_-]/g, '')}">`,
    `      <link>${cdata(link)}</link>`,
    `      <name>${cdata(name)}</name>`,
    `      <region>${cdata(reg)}</region>`,
    ...(salary ? [`      <salary>${cdata(salary)}</salary>`] : []),
    `      <description>${cdata(description)}</description>`,
    ...(job.company?.trim() ? [`      <company>${cdata(job.company.trim())}</company>`] : []),
    `      <pubdate>${formatJoobleDate(published)}</pubdate>`,
    ...(job.updatedAt ? [`      <updated>${formatJoobleDate(job.updatedAt)}</updated>`] : []),
    ...(job.validThrough ? [`      <expire>${formatJoobleDate(job.validThrough)}</expire>`] : []),
    ...(type ? [`      <jobtype>${type}</jobtype>`] : []),
    `    </job>`,
  ]
  return lines.join('\n')
}

export function buildJoobleFeedXml(jobs: JoobleJob[], siteUrl: string, now: number = Date.now()): { xml: string; count: number } {
  const items = jobs.map((j) => buildJoobleJobXml(j, siteUrl, now)).filter((x): x is string => x !== null)
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<jobs>\n${items.join('\n')}\n</jobs>\n`
  return { xml, count: items.length }
}
