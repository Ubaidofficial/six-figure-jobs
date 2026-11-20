// lib/scrapers/freehireCompanyWebsites.ts
//
// Which employers the freehire sync still needs to ask freehire about for a website (owner's request, 2026-11-19: cache
// the lookups to free freehire's daily request budget). Each lookup is one request; a sync asked about every employer
// in the batch, 400-1,100 a run, every run, though the website only fills an empty one (lib/companies/upsertFromBoard.ts)
// and freehire has none for about half of them. Skipped now:
//  - an employer we already hold a valid website for (every company saved under that name has one);
//  - an employer asked in the last WEBSITE_RECHECK_DAYS days, found or not (Company.freehireWebsiteCheckedAt).
// Employers are matched the way the ingest matches them: the cleaned company name, case-insensitive.

import { boardCompanyName } from '../companies/upsertFromBoard'
import { normalizePublicCompanyWebsite } from '../companies/website'
import { makeBoardSource } from '../ingest/sourcePriority'
import { prisma } from '../prisma'

export const WEBSITE_RECHECK_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export type KnownCompany = { hasWebsite: boolean; checkedAt: Date | null }

/** The lower-case company name a freehire job is saved under, or null when it is not a company name. */
export function freehireCompanyKey(rawName: string | null | undefined): string | null {
  return boardCompanyName(rawName ?? null, makeBoardSource('freehire'))?.toLowerCase() ?? null
}

/** Pure: the freehire company slugs still to look up, and why the others were skipped. */
export function companiesToLookUp(
  wanted: ReadonlyArray<{ slug: string; key: string | null }>,
  known: ReadonlyMap<string, KnownCompany>,
  now: Date,
): { lookUp: string[]; hasWebsite: number; checkedRecently: number } {
  const lookUp: string[] = []
  let hasWebsite = 0
  let checkedRecently = 0
  for (const w of wanted) {
    const k = w.key ? known.get(w.key) : undefined
    if (k?.hasWebsite) hasWebsite++
    else if (k?.checkedAt && now.getTime() - k.checkedAt.getTime() < WEBSITE_RECHECK_DAYS * DAY_MS) checkedRecently++
    else lookUp.push(w.slug)
  }
  return { lookUp, hasWebsite, checkedRecently }
}

/**
 * What we hold for these company names. Several companies can share a name in any case; the ingest picks one of them,
 * so a name counts as having a website only when every one has a valid website, and as checked at the oldest check.
 */
export async function loadKnownCompanies(keys: string[]): Promise<Map<string, KnownCompany>> {
  const out = new Map<string, KnownCompany>()
  if (keys.length === 0) return out
  const rows = await prisma.$queryRaw<Array<{ key: string; website: string | null; checked: Date | null }>>`
    SELECT lower("name") AS key, "website", "freehireWebsiteCheckedAt" AS checked
    FROM "Company" WHERE lower("name") = ANY(${keys}::text[])`
  for (const r of rows) {
    const valid = Boolean(r.website && normalizePublicCompanyWebsite(r.website))
    const prev = out.get(r.key)
    out.set(r.key, {
      hasWebsite: prev ? prev.hasWebsite && valid : valid,
      checkedAt: prev ? (prev.checkedAt && r.checked ? (prev.checkedAt < r.checked ? prev.checkedAt : r.checked) : null) : r.checked,
    })
  }
  return out
}

/** Records that freehire was asked about these companies (after the ingest, so companies new in this run are marked too). */
export async function markWebsiteChecked(keys: string[], now: Date): Promise<void> {
  if (keys.length === 0) return
  await prisma.$executeRaw`UPDATE "Company" SET "freehireWebsiteCheckedAt" = ${now} WHERE lower("name") = ANY(${keys}::text[])`
}
