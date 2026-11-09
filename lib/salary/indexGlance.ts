// lib/salary/indexGlance.ts
//
// The numbers and sentences the /salary index shows beside its role cards: the "at a glance" table rows, and the FAQ
// whose answers quote them. Pure, so the wording (and the tie case) is tested. The page renders the FAQ and its
// FAQPage JSON-LD from the same items.

import { MIN_LISTINGS } from '../jobs/salarySnapshot'
import type { RoleMedian } from './indexMedians'

export function formatMoneyShort(value: number | null): string {
  if (value == null) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value.toLocaleString('en-US')}`
}

export const roleName = (label: string) => label.replace(/ salary$/, '')

export type GlanceRow = { slug: string; name: string; median: number; p25: number | null; p75: number | null; listings: number }

/** Roles with enough listings to quote a median, highest first. Empty when the lookup failed. */
export function glanceRows(
  medians: Map<string, RoleMedian> | null,
  guides: Array<{ slug: string; label: string }>,
): GlanceRow[] {
  if (!medians) return []
  return guides.flatMap((g) => {
    const s = medians.get(g.slug)
    return s?.median != null ? [{ slug: g.slug, name: roleName(g.label), median: s.median, p25: s.p25, p75: s.p75, listings: s.listings }] : []
  }).sort((a, b) => b.median - a.median)
}

/** Questions answered from the same numbers as the table. The visible FAQ and the FAQPage JSON-LD both use this. */
export function salaryFaq(rows: GlanceRow[]): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = []
  if (rows.length >= 2 && rows[0].median !== rows[rows.length - 1].median) {
    const top = rows[0]
    const bottom = rows[rows.length - 1]
    items.push({
      question: 'Which tech roles pay the most on Six Figure Jobs?',
      answer: `Among the ${rows.length} roles with enough listings to quote a median, ${top.name} is highest at ${formatMoneyShort(top.median)} and ${bottom.name} is lowest at ${formatMoneyShort(bottom.median)}. These are medians of US-dollar listings that show their pay.`,
    })
  }
  items.push(
    {
      question: 'How is the median calculated?',
      answer: `Each US-dollar listing that shows its pay counts once, at the midpoint of its published range. A role gets a median only when at least ${MIN_LISTINGS} listings back it, so a handful of postings never passes for a market figure.`,
    },
    {
      question: 'Are these salaries in US dollars?',
      answer: 'The role medians on this page are in US dollars. Country guides show local currency (GBP, EUR, CAD, AUD, SGD), so use the country guide for pay outside the US.',
    },
    {
      question: 'Where do the listings come from?',
      answer: 'Job postings that publish a salary at or above the six-figure threshold for their currency, collected from employers’ career pages and job boards. Expired postings are removed, and each job says whether its apply button opens the employer’s own page or the job board it was posted on.',
    },
  )
  return items
}
