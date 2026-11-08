import fs from 'fs'
import path from 'path'

import { COMPANY_SIZE_BUCKETS, SENIORITY_LEVELS, readHubExtraFilters } from '../../lib/jobs/hubFilters'
import { buildWhere } from '../../lib/jobs/queryJobs'

const read = (params: Record<string, string[]>) => (key: string) => params[key] ?? []
const source = (file: string) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8')
// where-clauses carry BigInt salary thresholds, which JSON.stringify cannot print
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))
const andOf = (where: any) => (Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [])

describe('the sidebar lists match what the pipeline writes', () => {
  it('company sizes are the buckets the company enricher writes (the old list had "1-10" and "1000+", which no company has)', () => {
    const enricher = source('lib/ai/companyEnricher.ts')
    const allowed = [...enricher.match(/ALLOWED_SIZES = new Set\(\[(.*?)\]\)/s)![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(COMPANY_SIZE_BUCKETS.map((b) => b.value)).toEqual(allowed.filter((v) => v !== '1-10'))
    expect(allowed).not.toContain('1000+')
  })

  it('seniority levels are the ones the title inference can return (there is no "mid")', () => {
    const ingest = source('lib/ingest/index.ts')
    const body = ingest.slice(ingest.indexOf('function inferExperienceLevelFromTitle'))
    const returned = [...body.slice(0, body.indexOf('\n}\n')).matchAll(/return '([^']+)'/g)].map((m) => m[1])
    expect(new Set(SENIORITY_LEVELS.map((l) => l.value))).toEqual(new Set(returned))
  })
})

describe('buildWhere seniority', () => {
  it('filters on the level read from the title, not the RoleInference table that nothing writes', () => {
    const where: any = buildWhere({ seniorityLevels: ['senior', 'lead'] })
    expect(andOf(where)).toContainEqual({ experienceLevel: { in: ['senior', 'lead'] } })
    expect(where.roleInference).toBeUndefined()
  })

  it('adds nothing without a level', () => {
    const where: any = buildWhere({})
    expect(json(andOf(where))).not.toContain('experienceLevel')
  })
})

describe('readHubExtraFilters', () => {
  it('reads a known remote region and a city slug', () => {
    expect(readHubExtraFilters(read({ remoteRegion: ['europe'], city: ['New-York'] }))).toEqual({
      remoteRegion: 'europe',
      citySlug: 'new-york',
    })
  })

  it('drops what it does not know, so a mistyped link filters nothing instead of everything', () => {
    expect(readHubExtraFilters(read({ remoteRegion: ['narnia'], city: ['New York!'] }))).toEqual({
      remoteRegion: undefined,
      citySlug: undefined,
    })
  })

  it('returns nothing for a plain /jobs', () => {
    expect(readHubExtraFilters(read({}))).toEqual({ remoteRegion: undefined, citySlug: undefined })
  })

  it('feeds buildWhere: a region and a city each add their clause', () => {
    const where: any = buildWhere(readHubExtraFilters(read({ remoteRegion: ['us-only'], city: ['zug'] })))
    expect(where.citySlug).toBe('zug')
    expect(json(andOf(where))).toContain('"countryCode":{"in":["US"]}')
  })
})
