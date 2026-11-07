// lib/companies/europeanBoards.ts
//
// Greenhouse boards of employers with European offices, picked because a measured sample of their public postings
// (2026-11-07) showed European-located jobs that state a salary in the text. The daily ATS scrape reads each Company
// row's `atsUrl`, so onboarding a board means one Company row with `atsProvider` and `atsUrl` set. The salary rule is
// unchanged: a posting still needs a published, validated salary at or above its currency threshold to be listed.
//
// `planBoard` decides what to do with one board given the Company row that may already exist, and never overrides a
// row that already points somewhere else.

import { detectAtsFromUrl } from '../normalizers/ats'

export type EuropeanBoard = { name: string; boardSlug: string }

// European-located postings / of those, postings with a salary figure in the text (rough regex, not the app's salary
// check), from the public Greenhouse API on 2026-11-07. SumUp also posts in French, Italian, German and Portuguese.
export const EUROPEAN_GREENHOUSE_BOARDS: EuropeanBoard[] = [
  { name: 'Elastic', boardSlug: 'elastic' }, // 144 / 95
  { name: 'Deliveroo', boardSlug: 'deliveroo' }, // 43 / 25
  { name: 'Airbnb', boardSlug: 'airbnb' }, // 25 / 24
  { name: 'Okta', boardSlug: 'okta' }, // 27 / 23
  { name: 'Algolia', boardSlug: 'algolia' }, // 18 / 18
  { name: 'Grafana Labs', boardSlug: 'grafanalabs' }, // 49 / 15
  { name: 'SumUp', boardSlug: 'sumup' }, // 181 / 10
  { name: 'GoCardless', boardSlug: 'gocardless' }, // 9 / 9
  { name: 'Monzo', boardSlug: 'monzo' }, // 13 / 7
  { name: 'Pinterest', boardSlug: 'pinterest' }, // 12 / 8
  { name: 'Asana', boardSlug: 'asana' }, // 24 / 5
]

export function boardAtsUrl(board: EuropeanBoard): string {
  return `https://boards.greenhouse.io/${board.boardSlug}`
}

export function companySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type ExistingCompany = {
  id: string
  slug: string
  name: string
  atsProvider: string | null
  atsUrl: string | null
}

export type BoardPlan =
  | { action: 'create'; data: { name: string; slug: string; atsProvider: 'greenhouse'; atsUrl: string } }
  | { action: 'attach'; id: string; data: { atsProvider: 'greenhouse'; atsUrl: string } }
  | { action: 'skip'; reason: 'already-onboarded' | 'has-other-ats-settings' }

/** The existing row for a board: same board URL first, then same slug, then same name (any letter case). */
export function findExisting(board: EuropeanBoard, rows: ExistingCompany[]): ExistingCompany | null {
  const url = boardAtsUrl(board)
  const slugs = new Set([companySlug(board.name), board.boardSlug])
  return (
    rows.find((r) => detectAtsFromUrl(r.atsUrl)?.atsUrl === url) ??
    rows.find((r) => slugs.has(r.slug)) ??
    rows.find((r) => r.name.trim().toLowerCase() === board.name.toLowerCase()) ??
    null
  )
}

export function planBoard(board: EuropeanBoard, existing: ExistingCompany | null): BoardPlan {
  const atsUrl = boardAtsUrl(board)
  if (!existing) return { action: 'create', data: { name: board.name, slug: companySlug(board.name), atsProvider: 'greenhouse', atsUrl } }

  const current = detectAtsFromUrl(existing.atsUrl)
  if (existing.atsProvider === 'greenhouse' && current?.atsUrl === atsUrl) return { action: 'skip', reason: 'already-onboarded' }
  if (existing.atsProvider || existing.atsUrl) return { action: 'skip', reason: 'has-other-ats-settings' }
  return { action: 'attach', id: existing.id, data: { atsProvider: 'greenhouse', atsUrl } }
}
