// lib/jobs/highPayingJobs.ts
//
// /high-paying-jobs: roles ranked by the median pay of their live listings, and the highest-paying open jobs. Same
// method as the salary guides (lib/salary/indexMedians.ts): US-dollar listings that publish pay, each counted once at
// the midpoint of its range, and a role is ranked only when at least MIN_LISTINGS listings back its median. Roles are
// role pages (seniority folded in: "senior-software-engineer" counts toward Software Engineer), so every row links to
// a page that lists those jobs.
import { cache } from 'react'

import { memoAsync } from '@/lib/cache/memo'
import { prisma } from '@/lib/prisma'
import { roleLabelFor } from '@/lib/roles/relatedRoles'
import { rolePageFor } from '@/lib/roles/topRolePages'

import { getPublicJobWhere } from './publicStats'
import { queryJobs, type JobWithCompany } from './queryJobs'
import { MIN_LISTINGS, salaryMidpoint, summarizeSalaries } from './salarySnapshot'

/** Fewer ranked roles than this and /high-paying-jobs is too thin to offer to search engines (page and sitemap). */
export const HIGH_PAYING_MIN_ROLES_TO_INDEX = 5

export type RolePay = { slug: string; label: string; median: number; p25: number; p75: number; listings: number }

type Row = { roleSlug: string | null; minAnnual: unknown; maxAnnual: unknown }

/** Pure: listings to roles ranked by median pay, highest first; roles with too few listings are left out. */
export function rankRolesByPay(rows: Row[]): RolePay[] {
  const byRole = new Map<string, number[]>()
  for (const row of rows) {
    const page = rolePageFor(row.roleSlug)
    const mid = salaryMidpoint(row.minAnnual, row.maxAnnual)
    if (!page || mid === null || mid <= 0) continue
    byRole.set(page, [...(byRole.get(page) ?? []), mid])
  }
  const ranked: RolePay[] = []
  for (const [slug, values] of byRole) {
    const s = summarizeSalaries(values)
    if (s) ranked.push({ slug, label: roleLabelFor(slug), median: s.median, p25: s.p25, p75: s.p75, listings: s.count })
  }
  return ranked.sort((a, b) => b.median - a.median || b.listings - a.listings)
}

const money = (v: number) => `$${Math.round(v / 1000)}k`
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

/** Pure: the page's questions, answered from the same numbers as its table (visible FAQ and FAQPage JSON-LD). */
export function highPayingFaq(roles: RolePay[], listings: number): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = []
  if (roles.length >= 3) {
    const top = roles.slice(0, 3)
    items.push({
      question: 'What are the highest-paying jobs right now?',
      answer: `Among ${roles.length} roles with enough live listings to quote a median, the highest-paying are ${list(top.map((r) => `${r.label} (${money(r.median)})`))}. These are medians of US-dollar listings that publish their pay, so they move as jobs open and close.`,
    })
    const busiest = [...roles].sort((a, b) => b.listings - a.listings).slice(0, 3)
    items.push({
      question: 'Which high-paying jobs have the most openings?',
      answer: `${list(busiest.map((r) => `${r.label} (${r.listings.toLocaleString('en-US')} open listings, median ${money(r.median)})`))}.`,
    })
  }
  items.push(
    {
      question: 'How are these salaries calculated?',
      answer: `From ${listings.toLocaleString('en-US')} live US-dollar listings that publish a salary. Each listing counts once, at the midpoint of its range, and a role is ranked only when at least ${MIN_LISTINGS} listings back it. Senior, staff and principal titles count toward their role.`,
    },
    {
      question: 'Do all of these jobs pay six figures?',
      answer: 'Every listing here publishes a salary that reaches $100k (or the local equivalent outside the US). The median is the middle of those published ranges, so about half of a role’s listings pay more and half pay less.',
    },
  )
  return items
}

export type HighPayingJobs = { roles: RolePay[]; topJobs: JobWithCompany[]; listings: number }

/** Cached 30 minutes (served stale while it refreshes). A failure in the top-jobs query only empties that list. */
export const loadHighPayingJobs = cache(() =>
  memoAsync('high-paying-jobs', 30 * 60 * 1000, async (): Promise<HighPayingJobs> => {
    const [rows, top] = await Promise.all([
      prisma.job.findMany({
        where: { AND: [getPublicJobWhere(), { currency: 'USD' }] },
        select: { roleSlug: true, minAnnual: true, maxAnnual: true },
      }),
      queryJobs({ currency: 'USD', sortBy: 'salary', page: 1, pageSize: 10, excludeInternships: true }).catch(() => null),
    ])
    return { roles: rankRolesByPay(rows), topJobs: top?.jobs ?? [], listings: rows.length }
  }),
)

export { MIN_LISTINGS }
