// scripts/auditRemote100kCoverage.ts
//
// READ-ONLY. Are we showing the jobs remote100k.com lists (owner's request, 2026-11-25: "make sure we are scraping all the
// jobs from https://remote100k.com/")? Reads remote100k's public sitemap and each /remote-job/ page's JobPosting JSON-LD
// (robots.txt allows them; 4 at a time, the existing scraper's reader, lib/scrapers/remote100k.ts), then looks each job up
// among our live jobs: by the employer's apply link, else by company and title. The jobs we lack are grouped by company and
// by the careers system their apply link points to, which is how they are added: the employer's own board
// (lib/constants/directEmployers.ts), never remote100k's copy (its direct import was switched off after it brought in bad
// jobs; apply links must go to the employer). Every database statement is a SELECT in a READ ONLY transaction.
//
//   npx tsx scripts/auditRemote100kCoverage.ts [--max=1500]
import { appendFileSync } from 'node:fs'

import { fetchJobDetail, loadJobUrlsFromSitemap } from '../lib/scrapers/remote100k'
import { detectATS } from '../lib/scrapers/utils/detectATS'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

/** Lower case letters and digits only ("Acme, Inc." -> "acmeinc"); company suffixes dropped (pure). */
export function normCompany(name: string | null | undefined): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|gmbh|corp|corporation|co|company|technologies|technology|labs|hq)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** Title words without punctuation or a trailing "(remote)" ("Sr. Engineer (Remote)" -> "sr engineer") (pure). */
export function normTitle(title: string | null | undefined): string {
  return String(title ?? '')
    .toLowerCase()
    .replace(/\((?:remote|hybrid|us|usa|global)[^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** An apply link without query, fragment, "www." or a trailing slash, so the employer's page matches either way (pure). */
export function normUrl(url: string | null | undefined): string {
  try {
    const u = new URL(String(url ?? ''))
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase()
  } catch {
    return ''
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

type R100kJob = { url: string; title: string; company: string; applyUrl: string | null; posted: string | null }

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const max = Math.max(1, Math.min(Number(arg('max')) || 1500, 3000))
  const out: string[] = ['## remote100k.com coverage (read-only)', '']

  const urls = (await loadJobUrlsFromSitemap()).slice(0, max)
  let failed = 0
  const parsed = await mapLimit(urls, 4, async (url): Promise<R100kJob | null> => {
    try {
      const d = await fetchJobDetail(url)
      if (!d?.jsonLd?.title) return null
      return { url, title: d.jsonLd.title, company: d.jsonLd.hiringOrganization?.name ?? '', applyUrl: d.externalApplyUrl, posted: d.jsonLd.datePosted ?? null }
    } catch {
      failed++
      return null
    }
  })
  const jobs = parsed.filter((j): j is R100kJob => Boolean(j))
  out.push(`remote100k's sitemap lists ${urls.length} job pages; read ${jobs.length} (${failed} failed, ${urls.length - jobs.length - failed} without a JobPosting).`, '')

  const { prisma } = await import('../lib/prisma')
  const ours = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      return tx.job.findMany({ where: { isExpired: false }, select: { title: true, company: true, applyUrl: true, url: true } })
    },
    { timeout: 120_000 },
  )
  await prisma.$disconnect()

  const byUrl = new Set<string>()
  const byCompanyTitle = new Set<string>()
  const companies = new Set<string>()
  for (const j of ours) {
    for (const u of [j.applyUrl, j.url]) if (normUrl(u)) byUrl.add(normUrl(u))
    byCompanyTitle.add(`${normCompany(j.company)}|${normTitle(j.title)}`)
    companies.add(normCompany(j.company))
  }

  let viaUrl = 0
  let viaTitle = 0
  const missingKnown: R100kJob[] = []
  const missingUnknown: R100kJob[] = []
  for (const j of jobs) {
    const u = normUrl(j.applyUrl?.replace(/[?&]ref=remote100k/, ''))
    if (u && byUrl.has(u)) viaUrl++
    else if (byCompanyTitle.has(`${normCompany(j.company)}|${normTitle(j.title)}`)) viaTitle++
    else if (companies.has(normCompany(j.company))) missingKnown.push(j)
    else missingUnknown.push(j)
  }
  const have = viaUrl + viaTitle
  out.push(
    `We have **${have} of ${jobs.length}** (${jobs.length ? Math.round((have / jobs.length) * 100) : 0}%): ${viaUrl} by apply link, ${viaTitle} by company and title.`,
    `Missing: ${missingKnown.length + missingUnknown.length}. Of those, ${missingKnown.length} are at companies we already have jobs from (that job is missing), ${missingUnknown.length} at companies we have no live job from.`,
    '',
  )

  const group = (list: R100kJob[]) => {
    const m = new Map<string, { jobs: number; ats: Map<string, number>; example: string }>()
    for (const j of list) {
      const e = m.get(j.company) ?? { jobs: 0, ats: new Map<string, number>(), example: j.applyUrl ?? j.url }
      e.jobs++
      const ats = j.applyUrl ? detectATS(j.applyUrl) : 'none'
      e.ats.set(ats, (e.ats.get(ats) ?? 0) + 1)
      m.set(j.company, e)
    }
    return [...m.entries()].sort((a, b) => b[1].jobs - a[1].jobs)
  }
  const atsTotals = new Map<string, number>()
  for (const j of [...missingKnown, ...missingUnknown]) {
    const ats = j.applyUrl ? detectATS(j.applyUrl) : 'none'
    atsTotals.set(ats, (atsTotals.get(ats) ?? 0) + 1)
  }
  out.push(`Missing jobs by the careers system their apply link points to: ${[...atsTotals.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}`, '')
  for (const [label, list] of [['Companies we have no live job from', missingUnknown], ['Companies we have, missing these jobs', missingKnown]] as const) {
    out.push(`### ${label}`, '')
    for (const [company, e] of group(list).slice(0, 60)) {
      out.push(`- ${company || '(no name)'}: ${e.jobs} · ${[...e.ats.entries()].map(([k, n]) => `${k} ${n}`).join(', ')} · ${e.example.slice(0, 110)}`)
    }
    out.push('')
  }
  const text = out.join('\n') + '\n'
  process.stdout.write(text)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text)
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
}
