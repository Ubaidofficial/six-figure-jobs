import { detectAtsFromUrl } from '../../lib/normalizers/ats'
import {
  EUROPEAN_GREENHOUSE_BOARDS,
  boardAtsUrl,
  companySlug,
  findExisting,
  planBoard,
  type ExistingCompany,
} from '../../lib/companies/europeanBoards'

const grafana = EUROPEAN_GREENHOUSE_BOARDS.find((b) => b.name === 'Grafana Labs')!

const row = (over: Partial<ExistingCompany>): ExistingCompany => ({
  id: 'c1',
  slug: 'some-slug',
  name: 'Some Name',
  atsProvider: null,
  atsUrl: null,
  ...over,
})

describe('European Greenhouse boards list', () => {
  it('has unique names and board slugs', () => {
    expect(new Set(EUROPEAN_GREENHOUSE_BOARDS.map((b) => b.name)).size).toBe(EUROPEAN_GREENHOUSE_BOARDS.length)
    expect(new Set(EUROPEAN_GREENHOUSE_BOARDS.map((b) => b.boardSlug)).size).toBe(EUROPEAN_GREENHOUSE_BOARDS.length)
  })

  it.each(EUROPEAN_GREENHOUSE_BOARDS.map((b) => [b.name, b] as const))(
    'builds a board URL the scraper recognises as Greenhouse: %s',
    (_name, board) => {
      expect(detectAtsFromUrl(boardAtsUrl(board))).toEqual({ provider: 'greenhouse', atsUrl: boardAtsUrl(board) })
    },
  )

  it('makes a plain slug from a name', () => {
    expect(companySlug('Grafana Labs')).toBe('grafana-labs')
    expect(companySlug('AT&T Cloud')).toBe('at-and-t-cloud')
  })
})

describe('planBoard', () => {
  it('creates a company that does not exist', () => {
    expect(planBoard(grafana, null)).toEqual({
      action: 'create',
      data: { name: 'Grafana Labs', slug: 'grafana-labs', atsProvider: 'greenhouse', atsUrl: 'https://boards.greenhouse.io/grafanalabs' },
    })
  })

  it('sets the board on an existing company that has no ATS yet', () => {
    expect(planBoard(grafana, row({ id: 'g1', slug: 'grafana-labs', name: 'Grafana Labs' }))).toEqual({
      action: 'attach',
      id: 'g1',
      data: { atsProvider: 'greenhouse', atsUrl: 'https://boards.greenhouse.io/grafanalabs' },
    })
  })

  it('does nothing when the company already uses this board, whatever URL form it was saved with', () => {
    const saved = row({ atsProvider: 'greenhouse', atsUrl: 'https://job-boards.greenhouse.io/grafanalabs/jobs/123' })
    expect(planBoard(grafana, saved)).toEqual({ action: 'skip', reason: 'already-onboarded' })
  })

  it('never overrides a company that points at another board or another ATS', () => {
    expect(planBoard(grafana, row({ atsProvider: 'lever', atsUrl: 'https://jobs.lever.co/grafana' }))).toEqual({ action: 'skip', reason: 'has-other-ats-settings' })
    expect(planBoard(grafana, row({ atsProvider: 'greenhouse', atsUrl: 'https://boards.greenhouse.io/other' }))).toEqual({ action: 'skip', reason: 'has-other-ats-settings' })
    expect(planBoard(grafana, row({ atsProvider: 'greenhouse', atsUrl: null }))).toEqual({ action: 'skip', reason: 'has-other-ats-settings' })
  })
})

describe('findExisting', () => {
  const rows = [
    row({ id: 'a', slug: 'unrelated', name: 'Unrelated' }),
    row({ id: 'b', slug: 'x', name: 'GRAFANA LABS' }),
    row({ id: 'c', slug: 'grafanalabs', name: 'Grafana' }),
    row({ id: 'd', slug: 'y', name: 'Y', atsProvider: 'greenhouse', atsUrl: 'https://boards.greenhouse.io/grafanalabs' }),
  ]

  it('prefers the row that already has this board, then the slug, then the name', () => {
    expect(findExisting(grafana, rows)?.id).toBe('d')
    expect(findExisting(grafana, rows.slice(0, 3))?.id).toBe('c')
    expect(findExisting(grafana, rows.slice(0, 2))?.id).toBe('b')
    expect(findExisting(grafana, rows.slice(0, 1))).toBeNull()
  })
})
