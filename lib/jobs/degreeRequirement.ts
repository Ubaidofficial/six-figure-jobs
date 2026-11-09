// lib/jobs/degreeRequirement.ts
//
// Whether a posting asks for a college degree, read from its description. Used by /jobs/no-degree, which used to list
// every software, DevOps, data and sales job as "jobs that don't require a college degree" without looking (found
// 2026-11-09). A job counts as open to people without a degree when its description does not ask for one, or asks
// for one but accepts equivalent experience. The phrase lists are the single source: the classifier below (tested)
// and the database filter are built from the same lists.
//
// Plain case-insensitive substring matching, so the database can run the same rule (one `~*` regex of the literal
// phrases). Phrases avoid the bare
// word "degree", which also means "360-degree" or "a high degree of ownership". Scanning every description takes about
// four seconds (165 MB of text on 2026-11-09), so the database pass runs at most hourly (loadDegreeRequiredJobIds) and
// pages filter by its result rather than scanning on each visit.
import { Prisma } from '@prisma/client'

import { memoAsync } from '@/lib/cache/memo'
import { prisma } from '@/lib/prisma'

/** A posting that contains one of these asks for a degree (unless it also accepts equivalent experience). */
export const DEGREE_PHRASES = [
  'bachelor',
  "master's degree",
  'master’s degree',
  'masters degree',
  'ph.d',
  'phd',
  'doctorate',
  'degree in ',
  'degree from',
  'university degree',
  'college degree',
  '4-year degree',
  'four-year degree',
  'undergraduate degree',
  'graduate degree',
  'advanced degree',
  'bs/ms',
  'bs/ba',
  'ba/bs',
  'b.s. in',
  'b.a. in',
  'bs degree',
  'ba degree',
  'ms/phd',
  'm.s. in',
  // Professional degrees ("A Doctor of Veterinary Medicine degree (DVM, VMD) is required", Chewy, 2026-11-09).
  'doctor of',
  'dvm',
  'vmd',
  'juris doctor',
  'j.d.',
  'm.d.',
  'pharmd',
  'pharm.d',
  'medical degree',
  'law degree',
  // Abbreviations only as whole words: after a space or the end of an HTML tag ("teams in" must not read as "ms in").
  ' bs in ',
  '>bs in ',
  ' ba in ',
  '>ba in ',
  ' ms in ',
  '>ms in ',
  ' bs or ms',
  '>bs or ms',
] as const

/**
 * A posting that contains one of these does not insist on the degree. Not a bare "or equivalent", which also follows
 * tools ("SystemVerilog/UVM or equivalent methodologies"); the phrase has to tie the equivalence to the degree or to
 * experience.
 */
export const DEGREE_OPTIONAL_PHRASES = [
  'degree or equivalent',
  'degree, or equivalent',
  'field or equivalent',
  'field, or equivalent',
  'ph.d. or equivalent',
  'phd or equivalent',
  'or equivalent education',
  'or equivalent training',
  'equivalent experience',
  'equivalent practical',
  'equivalent work experience',
  'equivalent professional experience',
  'equivalent combination',
  'in lieu of a degree',
  'in lieu of degree',
  'degree or relevant experience',
  'degree or related experience',
  'or related experience',
  'or relevant experience',
  'no degree required',
  'degree not required',
  'degree is not required',
  'without a degree',
  'regardless of degree',
] as const

export type DegreeRequirement = 'required' | 'equivalent_accepted' | 'not_mentioned'

/** Pure: what the description says about a degree. Null or empty text is 'not_mentioned'. */
export function degreeRequirement(description: string | null | undefined): DegreeRequirement {
  const text = String(description ?? '').toLowerCase()
  const asksForDegree = DEGREE_PHRASES.some((p) => text.includes(p))
  if (!asksForDegree) return 'not_mentioned'
  return DEGREE_OPTIONAL_PHRASES.some((p) => text.includes(p)) ? 'equivalent_accepted' : 'required'
}

/** The phrases as one case-insensitive regular expression for Postgres (`~*`), every character taken literally. */
export function phrasesRegex(phrases: readonly string[]): string {
  return phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
}

export type DegreeRequiredJobs = { ids: string[]; classifiedAt: Date }

/**
 * Live jobs whose description asks for a degree without accepting equivalent experience, with the time of the pass.
 * Pages list jobs created before `classifiedAt` and not in `ids`, so a job added since the last pass waits for the
 * next one instead of being listed unchecked. Cached for an hour (served stale while it refreshes).
 */
export function loadDegreeRequiredJobIds(): Promise<DegreeRequiredJobs> {
  return memoAsync('degree-required-job-ids', 60 * 60 * 1000, async () => {
    const classifiedAt = new Date()
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "Job"
      WHERE "isExpired" = false
        AND "descriptionHtml" ~* ${phrasesRegex(DEGREE_PHRASES)}
        AND NOT "descriptionHtml" ~* ${phrasesRegex(DEGREE_OPTIONAL_PHRASES)}
    `)
    return { ids: rows.map((r) => r.id), classifiedAt }
  })
}

/** Filter for jobs open to people without a degree, given the latest pass. Jobs with no description are left out. */
export function noDegreeRequiredWhere(pass: DegreeRequiredJobs): Prisma.JobWhereInput {
  return {
    descriptionHtml: { not: null },
    createdAt: { lte: pass.classifiedAt },
    ...(pass.ids.length ? { id: { notIn: pass.ids } } : {}),
  }
}
