// The job a kit is made for, found the same way the job page finds it (by the slug in its URL).

import { parseJobSlugParam } from '@/lib/jobs/jobSlug'
import { prisma } from '@/lib/prisma'

export interface KitJob {
  id: string
  title: string
  company: string
  applyUrl: string | null
  descriptionHtml: string | null
}

export async function findKitJob(slug: string): Promise<KitJob | null> {
  let parsed: ReturnType<typeof parseJobSlugParam>
  try {
    parsed = parseJobSlugParam(slug)
  } catch {
    return null // a malformed %-escape in the URL
  }
  const ors: Array<Record<string, string>> = []
  if (parsed.jobId) ors.push({ id: parsed.jobId })
  if (parsed.externalId) ors.push({ externalId: parsed.externalId })
  if (parsed.shortId) ors.push({ shortId: parsed.shortId })
  if (ors.length === 0) return null
  return prisma.job.findFirst({
    where: { OR: ors, isExpired: false },
    select: { id: true, title: true, company: true, applyUrl: true, descriptionHtml: true },
  })
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }

/** Job description HTML as readable plain text (block tags become line breaks). Decodes entities first: some sources store escaped HTML. */
export function jobHtmlToText(html: string | null | undefined): string {
  const decode = (s: string) => s.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, e: string) => ENTITIES[e])
  let s = decode(String(html ?? ''))
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  s = s.replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '- ')
  s = s.replace(/<[^>]+>/g, ' ')
  return decode(s)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
