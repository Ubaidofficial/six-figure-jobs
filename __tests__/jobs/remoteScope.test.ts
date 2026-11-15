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
