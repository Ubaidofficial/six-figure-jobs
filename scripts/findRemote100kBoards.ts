// scripts/findRemote100kBoards.ts
//
// READ-ONLY (public pages and APIs only; no database). For the remote100k.com coverage gap (owner's request, 2026-11-25:
// "do all three", item 2): finds the employer careers boards behind remote100k's jobs that we do not read yet, so they
// can be added to lib/constants/directEmployers.ts. For each remote100k job (lib/scrapers/remote100k.ts reader), the apply
// link names the board: a Greenhouse token, an Ashby or Lever account, or a Workday tenant and site. Career sites that
// embed Greenhouse or Ashby ("?gh_jid=", "?ashby_jid=") are resolved by asking the platform for that exact job under
// tokens made from the company name. A board is proposed only when it is not in DIRECT_EMPLOYERS, it answers, and (for
// Greenhouse, whose API names the board) its own name matches the company, as in the 2026-11-09 audit. For each, how many
// of its jobs state pay in the posting is counted, since only those are listed here.
//
//   npx tsx scripts/findRemote100kBoards.ts [--max=1500]
import { DIRECT_EMPLOYERS, type DirectEmployer } from '../lib/constants/directEmployers'
import { fetchJobDetail, loadJobUrlsFromSitemap } from '../lib/scrapers/remote100k'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const UA = { 'User-Agent': 'SixFigureJobs/1.0 (+job-board-scraper)', Accept: 'application/json' }

type Board = { provider: DirectEmployer['provider']; boardUrl: string; key: string }

/** Lower case letters and digits only (pure). */
export const alnum = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')

/** The board an apply link names directly, when it does (pure). */
export function boardFromLink(link: string): Board | null {
  let u: URL
  try {
    u = new URL(link)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  const first = u.pathname.split('/').filter(Boolean)[0]
  if (/(^|\.)greenhouse\.io$/.test(host) && first && first !== 'embed') {
    return { provider: 'greenhouse', boardUrl: `https://boards.greenhouse.io/${first}`, key: `greenhouse:${first.toLowerCase()}` }
  }
  if (host === 'jobs.ashbyhq.com' && first) return { provider: 'ashby', boardUrl: `https://jobs.ashbyhq.com/${first}`, key: `ashby:${first.toLowerCase()}` }
  if (host === 'jobs.lever.co' && first) return { provider: 'lever', boardUrl: `https://jobs.lever.co/${first}`, key: `lever:${first.toLowerCase()}` }
  const wd = host.match(/^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/)
  if (wd) {
    const parts = u.pathname.split('/').filter(Boolean)
    const site = /^[a-z]{2}-[A-Z]{2}$/.test(parts[0] ?? '') ? parts[1] : parts[0]
    if (site) return { provider: 'workday', boardUrl: `https://${host}/${site}`, key: `workday:${wd[1]}/${site.toLowerCase()}` }
  }
  return null
}

/** The key of a board already in DIRECT_EMPLOYERS (pure). */
export function knownKey(e: DirectEmployer): string | null {
  return boardFromLink(e.boardUrl)?.key ?? null
}

/** Board tokens to try for a company that embeds a platform on its own site (pure). */
export function tokenGuesses(company: string): string[] {
  const words = company.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean)
  const all = words.join('')
  const noSuffix = words.filter((w) => !['inc', 'llc', 'ltd', 'co', 'corp', 'hq', 'ai', 'io', 'labs', 'technologies', 'software'].includes(w)).join('')
  return [...new Set([all, noSuffix, words[0], `${all}inc`, `${all}jobs`, `${all}careers`, words.join('-')].filter((t) => t && t.length >= 2))]
}

async function json(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

async function resolveEmbedded(link: string, company: string): Promise<Board | null> {
  const gh = link.match(/[?&]gh_jid=(\d{5,})/i)?.[1]
  if (gh) {
    for (const t of tokenGuesses(company)) {
      if (await json(`https://boards-api.greenhouse.io/v1/boards/${t}/jobs/${gh}`)) {
        return { provider: 'greenhouse', boardUrl: `https://boards.greenhouse.io/${t}`, key: `greenhouse:${t}` }
      }
    }
    return null
  }
  const ab = link.match(/[?&]ashby_jid=([0-9a-f-]{36})/i)?.[1]?.toLowerCase()
  if (ab) {
    for (const t of tokenGuesses(company)) {
      const d = (await json(`https://api.ashbyhq.com/posting-api/job-board/${t}`)) as { jobs?: Array<{ id: string }> } | null
      if (d?.jobs?.some((j) => j.id.toLowerCase() === ab)) return { provider: 'ashby', boardUrl: `https://jobs.ashbyhq.com/${t}`, key: `ashby:${t}` }
    }
  }
  return null
}

const PAY = /\$\s?\d{2,3}(?:,\d{3}|k)|[£€]\s?\d{2,3}(?:,\d{3}|k)|\b\d{2,3},\d{3}\s?(?:usd|cad|gbp|eur)\b/i

/** Jobs on the board, and how many state pay in the posting; null when the board does not answer. */
async function boardJobs(b: Board): Promise<{ jobs: number; withPay: number; name: string | null } | null> {
  if (b.provider === 'greenhouse') {
    const token = b.boardUrl.split('/').pop()
    const meta = (await json(`https://boards-api.greenhouse.io/v1/boards/${token}`)) as { name?: string } | null
    const d = (await json(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`)) as { jobs?: Array<{ content?: string }> } | null
    if (!d?.jobs) return null
    const text = (s: string | undefined) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, ' ')
    return { jobs: d.jobs.length, withPay: d.jobs.filter((j) => PAY.test(text(j.content))).length, name: meta?.name ?? null }
  }
  if (b.provider === 'ashby') {
    const d = (await json(`https://api.ashbyhq.com/posting-api/job-board/${b.boardUrl.split('/').pop()}?includeCompensation=true`)) as {
      jobs?: Array<{ compensation?: { compensationTierSummary?: string | null }; descriptionPlain?: string }>
    } | null
    if (!d?.jobs) return null
    return { jobs: d.jobs.length, withPay: d.jobs.filter((j) => j.compensation?.compensationTierSummary || PAY.test(j.descriptionPlain ?? '')).length, name: null }
  }
  if (b.provider === 'lever') {
    const d = (await json(`https://api.lever.co/v0/postings/${b.boardUrl.split('/').pop()}?mode=json`)) as Array<{ salaryRange?: unknown; descriptionPlain?: string; additionalPlain?: string }> | null
    if (!Array.isArray(d)) return null
    return { jobs: d.length, withPay: d.filter((j) => j.salaryRange || PAY.test(`${j.descriptionPlain ?? ''} ${j.additionalPlain ?? ''}`)).length, name: null }
  }
  // Workday: the board answers; pay is read per job at sync, so it is not counted here.
  const u = new URL(b.boardUrl)
  const tenant = u.hostname.split('.')[0]
  const site = u.pathname.split('/').filter(Boolean)[0]
  try {
    const res = await fetch(`https://${u.hostname}/wday/cxs/${tenant}/${site}/jobs`, {
      method: 'POST',
      headers: { ...UA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const d = (await res.json()) as { total?: number }
    return { jobs: d.total ?? 0, withPay: -1, name: null }
  } catch {
    return null
  }
}

/** Whether a board's own name (when it has one) or token matches the company: one contains the other (pure). */
export function namesMatch(company: string, boardName: string | null, token: string): boolean {
  const c = alnum(company).replace(/(inc|llc|ltd|corp|hq)$/, '')
  const n = alnum(boardName ?? '')
  const t = alnum(token)
  if (n) return n.includes(c) || c.includes(n)
  return t.includes(c) || c.includes(t) || t.startsWith(c.slice(0, 5))
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }))
  return out
}

async function main() {
  const max = Math.max(1, Math.min(Number(arg('max')) || 1500, 3000))
  const urls = (await loadJobUrlsFromSitemap()).slice(0, max)
  const jobs = (await mapLimit(urls, 4, async (url) => {
    try {
      const d = await fetchJobDetail(url)
      return d?.jsonLd ? { company: d.jsonLd.hiringOrganization?.name ?? '', link: d.externalApplyUrl } : null
    } catch {
      return null
    }
  })).filter((j): j is { company: string; link: string | null } => Boolean(j?.link))

  const known = new Set(DIRECT_EMPLOYERS.map(knownKey).filter(Boolean))
  const byBoard = new Map<string, { board: Board; company: string; jobs: number }>()
  const unresolved = new Map<string, number>()
  for (const j of jobs) {
    const link = (j.link as string).replace(/[?&]ref=remote100k/, '')
    const board = boardFromLink(link) ?? (await resolveEmbedded(link, j.company))
    if (!board) {
      unresolved.set(j.company, (unresolved.get(j.company) ?? 0) + 1)
      continue
    }
    if (known.has(board.key)) continue
    const e = byBoard.get(board.key) ?? { board, company: j.company, jobs: 0 }
    e.jobs++
    byBoard.set(board.key, e)
  }

  console.log(`remote100k jobs read: ${jobs.length}; boards not in DIRECT_EMPLOYERS: ${byBoard.size}; jobs whose board could not be told from the link: ${[...unresolved.values()].reduce((a, b) => a + b, 0)}`)
  const accepted: string[] = []
  const rejected: string[] = []
  for (const { board, company, jobs: n } of [...byBoard.values()].sort((a, b) => b.jobs - a.jobs)) {
    const info = await boardJobs(board)
    const token = board.boardUrl.split('/').pop() ?? ''
    const workdayTenant = board.provider === 'workday' ? new URL(board.boardUrl).hostname.split('.')[0] : token
    if (!info) {
      rejected.push(`${company} · ${board.boardUrl} · no answer`)
      continue
    }
    if (!namesMatch(company, info.name, workdayTenant)) {
      rejected.push(`${company} · ${board.boardUrl} · board is "${info.name ?? workdayTenant}"`)
      continue
    }
    const slug = company.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    accepted.push(
      `  { slug: '${slug}', name: '${company.replace(/'/g, "\\'")}', provider: '${board.provider}', boardUrl: '${board.boardUrl}' }, // remote100k ${n}; board ${info.jobs} jobs${info.withPay >= 0 ? `, ${info.withPay} state pay` : ''}`,
    )
  }
  console.log('\nTo add (name checked):\n' + accepted.join('\n'))
  console.log('\nNot added:\n' + rejected.map((r) => `  ${r}`).join('\n'))
  console.log('\nBoard not told by the link (company: jobs):\n' + [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([c, n]) => `  ${c}: ${n}`).join('\n'))
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
}
