import { processLocation } from '../../lib/ingest/index'
import { countryFromText } from '../../lib/location/jobLocation'
import { mapOracleJob } from '../../lib/scrapers/ats/oraclecloud'

// Quality finding missing_country (2026-11-25): 538 listed jobs named a place but had no country. 392 were freehire jobs
// whose own `countries` field named the country ("Barmen, Wuppertal" -> de), 54 Workday jobs whose requisition states it
// (Basel, Bremen), and some texts our reader missed ("Colombia, Remote", "Remote California", "Athens, Attiki, Greece").
const place = (locationText: string, workplaceType: 'remote' | 'hybrid' | 'onsite' | null, countryCode: string | null, salaryCurrency = 'EUR') =>
  processLocation({ locationText, workplaceType, countryCode, salaryCurrency } as Parameters<typeof processLocation>[0]).countryCode

describe("the source's stated country", () => {
  it('places a job whose text the reader cannot', () => {
    expect(place('Barmen, Wuppertal', null, 'de')).toBe('DE')
    expect(place('Rotterdam - Hofplein 19', 'hybrid', 'NL')).toBe('NL')
    expect(place('Basel', 'onsite', 'CH')).toBe('CH')
    expect(place('', 'onsite', 'NL')).toBe('NL')
  })

  it('places a remote job whose text names one place', () => {
    expect(place('Chicago', 'remote', 'US', 'USD')).toBe('US')
    expect(place('San Francisco Bay Area', 'remote', 'US', 'USD')).toBe('US')
  })

  it('does not give a remote job at "Remote", "Worldwide" or a region a country', () => {
    expect(place('Remote', 'remote', 'US', 'USD')).toBeNull()
    expect(place('Remote / Worldwide', 'remote', 'US', 'USD')).toBeNull()
    expect(place('Remote - EMEA', 'remote', 'DE')).toBeNull()
  })

  it('never overrides a country the text names', () => {
    expect(place('London, United Kingdom', 'remote', 'US', 'USD')).toBe('GB')
    expect(place('Toronto, Canada', 'onsite', 'US', 'USD')).toBe('CA')
  })

  it('is ignored when it is not a country code', () => {
    expect(place('Barmen, Wuppertal', null, 'eu')).toBeNull()
    expect(place('Barmen, Wuppertal', null, 'Germany')).toBeNull()
  })

  it('is passed on by the Oracle reader', () => {
    const job = mapOracleJob({ host: 'x.oraclecloud.com', site: 'CX', lang: 'en' }, { Id: '1', Title: 'Engineer', PrimaryLocation: 'Pune', PrimaryLocationCountry: 'IN' })
    expect(job.countryCode).toBe('IN')
  })
})

describe('countryFromText reads more of what employers write', () => {
  it.each([
    ['Colombia, Remote', 'CO'],
    ['Athens, Attiki, Greece', 'GR'],
    ['Luxembourg, Luxembourg', 'LU'],
    ['Bulgaria', 'BG'],
    ['Romania remote', 'RO'],
    ['Remote California', 'US'],
    ['Remote new york', 'US'],
    ['California remote', 'US'],
  ])('%s -> %s', (text, cc) => {
    expect(countryFromText(text)).toBe(cc)
  })

  // Found by the backfill dry run (2026-11-25): a town in Catalonia read as the country Palau.
  it('reads a UN name only as the last part, not inside a town name', () => {
    expect(countryFromText('Palau-solità i Plegamans, Catalonia')).toBeNull()
    expect(countryFromText('Palau, solità i Plegamans, Catalonia')).toBeNull()
  })

  it.each(['Remote - Georgia', 'Georgia', 'Jordan', 'California'])('%s stays unread (ambiguous, or nothing before the state)', (text) => {
    expect(countryFromText(text)).toBeNull()
  })
})
