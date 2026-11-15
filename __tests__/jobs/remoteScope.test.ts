import { readRemoteScope } from '@/lib/jobs/remoteScope'

const read = (html: string) => readRemoteScope(html)

describe('readRemoteScope: limited to a place', () => {
  it('reads "must be located in" and work-authorization sentences', () => {
    expect(read('<p>Candidates must be located in the United States.</p>')).toMatchObject({ kind: 'countries', countries: ['US'] })
    expect(read('You must reside in Canada or the United States to be considered.')).toMatchObject({ kind: 'countries', countries: expect.arrayContaining(['CA', 'US']) })
    expect(read('You must be authorized to work in the United Kingdom.')).toMatchObject({ kind: 'countries', countries: ['GB'] })
  })
  it('reads "US only", "US-based" and "open to candidates in"', () => {
    expect(read('This is a US-based remote position.')).toMatchObject({ kind: 'countries', countries: ['US'] })
    expect(read('Remote (US residents only).')).toMatchObject({ kind: 'countries', countries: ['US'] })
    expect(read('We are open to candidates in Germany.')).toMatchObject({ kind: 'countries', countries: ['DE'] })
  })
  it('reads a region', () => {
    expect(read('We are hiring remotely across Europe.')).toMatchObject({ kind: 'region', region: 'europe' })
    expect(read('Our team works remotely in EU time zones.')).toMatchObject({ kind: 'region', region: 'europe' })
  })
  it('hands back the sentence it read', () => {
    expect(read('Great team. You must be located in the United States. Apply now.')?.quote).toBe('You must be located in the United States.')
  })
})

describe('readRemoteScope: open to the world', () => {
  it('reads an opening sentence when nothing limits the posting', () => {
    expect(read('<p>This role is fully remote and you can work from anywhere in the world.</p>')).toMatchObject({ kind: 'worldwide' })
    expect(read('We hire globally and are a remote-first company.')).toMatchObject({ kind: 'worldwide' })
  })
  it('does not call a job worldwide when any sentence limits it', () => {
    expect(read('Work from anywhere in the world. You must be authorized to work in the United States.')).toBeNull()
  })
  it('does not read "worldwide" about customers, offices or the company', () => {
    expect(read('We serve millions of customers worldwide.')).toBeNull()
    expect(read('Our brands are known around the world.')).toBeNull()
    expect(read('Join the global leader in payments.')).toBeNull()
  })
  it('does not read a limited "anywhere"', () => {
    expect(read('You can work from anywhere in the US.')).toMatchObject({ kind: 'countries', countries: ['US'] })
  })
})

describe('readRemoteScope: stays quiet when unsure', () => {
  it('gives nothing for two different places, or no statement at all', () => {
    expect(read('Must be located in the US. Must be located in the UK.')).toBeNull()
    expect(read('We are a fast growing team that loves coffee.')).toBeNull()
    expect(read('')).toBeNull()
    expect(read(null)).toBeNull()
  })
})

// Wrong readings found in the first audit of 5,784 live remote jobs (2026-11-15): "worldwide" in company marketing was read
// as the job being open to the world in about 650 of 800 conflicts; and three limit readings were partial or about pay.
describe('readRemoteScope: wrong readings from the first audit', () => {
  it.each([
    ['customers', 'More than 15,000 companies worldwide trust us to do exactly that.'],
    ['mission', 'Inclusive collaboration is critical to our mission of changing the management of disease worldwide.'],
    ['employees around the world', 'Our 30,000+ employees worldwide are creating the future.'],
    ['culture', '100% Remote, Global Culture - As a remote-only company, we bring together talent from around the world.'],
    ['a perk', '$1,000 travel perk on each Earnie-versary to anywhere in the world'],
    ['marketing', 'We are built as a remote-first company that enables you to do your best work from anywhere.'],
    ['an area', 'Work from anywhere in the NYC, LA or San Francisco area.'],
    ['distributed company', 'ClickHouse is a globally distributed company and remote-friendly.'],
    ['team across the globe', "We're 100% remote with team members across the globe."],
    ['certified', 'Great Place to Work Certified across the globe'],
  ])('does not read company boilerplate as "open to the world": %s', (_name, html) => {
    expect(read(html)).toBeNull()
  })
  it('reads "residing in the US and Canada" as both countries, not just the last', () => {
    expect(read('Open to candidates residing in the US and Canada.')).toMatchObject({ kind: 'countries', countries: expect.arrayContaining(['US', 'CA']) })
  })
  it('gives nothing when the sentence also names a place we cannot list', () => {
    expect(read('Remote in the United States or Latin America.')).toBeNull()
    expect(read('Candidates based in other listed US locations or remotely in Latin America may also be considered.')).toBeNull()
  })
  it('does not read a sentence about pay by location as a limit', () => {
    expect(read('Our hiring range is $148,000 - $180,000 for most US-based locations, $131,000 - $192,000 CAD in most Canada-based locations, £84,000 – £114,000 GBP for most UK-based locations.')).toBeNull()
  })
  it('still reads an explicit statement about where the person can work', () => {
    expect(read('This role is open to candidates anywhere in the world.')).toMatchObject({ kind: 'worldwide' })
    expect(read('We hire worldwide and you can work remotely from any country.')).toMatchObject({ kind: 'worldwide' })
    expect(read('Location: Worldwide')).toMatchObject({ kind: 'worldwide' })
  })
})

