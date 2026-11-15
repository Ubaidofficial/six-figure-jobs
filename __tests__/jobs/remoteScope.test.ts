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
  it('reads a list in front of "only" as the whole list ("US & Canada only" is not Canada only: third audit)', () => {
    expect(read('This role is 100% remote (US & Canada only) and will regularly meet with teams in the EU and the US.')).toMatchObject({ kind: 'countries', countries: expect.arrayContaining(['US', 'CA']) })
    expect(read('Remote (US, Canada and UK only).')).toMatchObject({ kind: 'countries', countries: expect.arrayContaining(['US', 'CA', 'GB']) })
    expect(read('Remote (US/Canada only).')).toMatchObject({ kind: 'countries', countries: expect.arrayContaining(['US', 'CA']) })
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

// Second audit (2026-11-15): after the boilerplate fix, the wrong readings left were all sentences that mention a place but
// are not about who may apply: benefits, pay notes, colleagues, a legal notice, a state abbreviation.
describe('readRemoteScope: sentences that mention a place but are not about who may apply', () => {
  it.each([
    ['benefits', 'Full medical, dental, and vision benefits for US, UK, and Canada-based employees'],
    ['benefits note', 'Note: Benefits and compensation reflect offerings for U.S.-based employees.'],
    ['benefits for employees', '100% paid medical, mental, dental, and vision premium option plus One Medical membership (for US-based employees).'],
    ['employees enjoy', 'Our US based employees enjoy:'],
    ['pay note', "The base salary range for this role's listed level is currently for residents of the United States only."],
    ['pay tiers', 'For US-based position the salary range is as follows:'],
    ['compensation for others', 'Compensation for Canadian-based candidates is not specified and can be discussed with the recruiter.'],
    ['team', 'Ability to work effectively across large timezone gaps, with regular overlap with our Australia-based team'],
    ['colleagues', 'Even though this position is based in Portugal, you will be working closely with US based employees.'],
    ['a colleague', 'Native or near-native Japanese and business-level English; able to work directly with a US-based CRO and cross-functional counterparts.'],
    ['an org', 'Lead as One Distributed Team: Operate the UK team as a single function with the US-based data science org.'],
    ['legal notice', 'For US based roles only: Pursuant to the San Francisco Fair Chance Ordinance, all qualified applicants with arrest and conviction records will be considered.'],
    ['a state', 'Will also consider Remote in CA only.'],
    ['preferred, a partial list', 'United States preferred; Open to Canada, the United Kingdom, and Germany.'],
    ['a company description', 'Lifted is the first talent, country, and contract-agnostic contingent workforce management solution, giving enterprises a way to source any type of talent.'],
    ['the team can work from anywhere', 'Because this role is open across the United States and can be based anywhere our team members work from, the salary range reflects that.'],
  ])('%s', (_name, html) => {
    expect(read(html)).toBeNull()
  })
  it('reads "anywhere in the United States" as a limit, not as the world', () => {
    expect(read('This is a remote position open to candidates based anywhere in the United States.')).toMatchObject({ kind: 'countries', countries: ['US'] })
  })
  it('still reads the explicit statements it read right', () => {
    expect(read('Must be authorized to work in the United States')).toMatchObject({ countries: ['US'] })
    expect(read('Remote within the United States.')).toMatchObject({ countries: ['US'] })
    expect(read('This is a U.S. based position.')).toMatchObject({ countries: ['US'] })
    expect(read('A growing company is hiring its first US-based Senior Account Executive.')).toMatchObject({ countries: ['US'] })
    expect(read('This role is only open to candidates based in the United Kingdom or Ireland.')).toMatchObject({ countries: expect.arrayContaining(['GB', 'IE']) })
    expect(read('This is a remote role open to candidates based in Canada, Germany, the UK, or the US.')).toMatchObject({ countries: expect.arrayContaining(['CA', 'DE', 'GB', 'US']) })
    expect(read('Work from anywhere in the world')).toMatchObject({ kind: 'worldwide' })
    expect(read('Note: This role is open to US-based applicants only.')).toMatchObject({ countries: ['US'] })
    expect(read('Location & Time Zone: This is a remote, U.S.-based role.')).toMatchObject({ countries: ['US'] })
    expect(read('Fully remote within the United States.')).toMatchObject({ countries: ['US'] })
  })
})
