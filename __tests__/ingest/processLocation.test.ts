import type { ScrapedJobInput } from '../../lib/ingest/types'

jest.mock('../../lib/prisma', () => ({ prisma: {} }))

import { processLocation } from '../../lib/ingest/index'

const job = (over: Partial<ScrapedJobInput>): ScrapedJobInput =>
  ({ externalId: 'x', title: 'Engineer', source: 'board:freehire', rawCompanyName: 'Acme', url: 'https://example.com/x', ...over }) as ScrapedJobInput

describe('processLocation country code', () => {
  it('still reads a country written at the end, unchanged', () => {
    expect(processLocation(job({ locationText: 'Paris, France', salaryCurrency: 'EUR' })).countryCode).toBe('FR')
    expect(processLocation(job({ locationText: 'Dublin, Ireland', salaryCurrency: 'EUR' })).countryCode).toBe('IE')
    expect(processLocation(job({ locationText: 'Zürich, Switzerland', salaryCurrency: 'CHF' })).countryCode).toBe('CH')
  })

  it('finds Germany and Austria from a state, which used to leave the job with no country', () => {
    expect(processLocation(job({ locationText: 'Nürnberg, Bayern', salaryCurrency: 'EUR' })).countryCode).toBe('DE')
    expect(processLocation(job({ locationText: 'Heidelberg, Baden-Württemberg', salaryCurrency: 'EUR' })).countryCode).toBe('DE')
    expect(processLocation(job({ locationText: 'Graz, Steiermark', salaryCurrency: 'EUR' })).countryCode).toBe('AT')
  })

  it('finds Switzerland from a canton or from the Swiss franc', () => {
    expect(processLocation(job({ locationText: 'Zürich, Kanton Zürich', salaryCurrency: 'CHF' })).countryCode).toBe('CH')
    expect(processLocation(job({ locationText: 'Dällikon', salaryCurrency: 'CHF' })).countryCode).toBe('CH')
  })

  it('reads a known city, or a national pay currency, for an on-site job with only a city', () => {
    expect(processLocation(job({ locationText: 'Munich', salaryCurrency: 'EUR' })).countryCode).toBe('DE')
    expect(processLocation(job({ locationText: 'Mitte, Berlin', salaryCurrency: 'EUR' })).countryCode).toBe('DE')
    expect(processLocation(job({ locationText: 'Hamburg, Hamburg', salaryCurrency: 'EUR' })).countryCode).toBe('DE')
    expect(processLocation(job({ locationText: 'Springfield', salaryCurrency: 'USD' })).countryCode).toBe('US')
    expect(processLocation(job({ locationText: 'Irvine, California', salaryCurrency: 'USD' })).countryCode).toBe('US')
    expect(processLocation(job({ locationText: 'Nellis AFB, NV, Nevada, United States', salaryCurrency: 'USD' })).countryCode).toBe('US')
  })

  it('does not guess from the euro, from a city that disagrees with the currency, or for a remote job', () => {
    expect(processLocation(job({ locationText: 'Kerestinec, HR', salaryCurrency: 'EUR' })).countryCode).toBeNull()
    expect(processLocation(job({ locationText: 'Schwetzingen, Rhein-Neckar-Kreis', salaryCurrency: 'EUR' })).countryCode).toBeNull()
    expect(processLocation(job({ locationText: 'Birmingham, Jefferson County', salaryCurrency: 'USD' })).countryCode).toBeNull()
    expect(processLocation(job({ locationText: 'Any Location / Remote', salaryCurrency: 'USD', isRemote: true })).countryCode).toBeNull()
  })

  it('keeps the city and the country found from its state, and leaves an unstated work type unknown', () => {
    const r = processLocation(job({ locationText: 'Nürnberg, Bayern', salaryCurrency: 'EUR' }))
    expect(r.countryCode).toBe('DE')
    expect(r.city).toBe('Nürnberg')
    expect(r.remoteMode).toBeNull()
  })
})

describe('processLocation work type', () => {
  // A place name alone was stored as on-site, so the description reader never marked such a job remote: a remote
  // "Software Architect" posting located "Germany" showed "Onsite" and had no TELECOMMUTE (2026-11-19 audit).
  it('does not turn a bare place name into on-site', () => {
    expect(processLocation(job({ locationText: 'Germany', salaryCurrency: 'EUR' })).remoteMode).toBeNull()
    expect(processLocation(job({ locationText: 'Austin, TX', salaryCurrency: 'USD' })).remoteMode).toBeNull()
  })

  it('still takes on-site, hybrid and remote from the source or the location wording', () => {
    expect(processLocation(job({ locationText: 'Austin, TX', workplaceType: 'onsite' })).remoteMode).toBe('onsite')
    expect(processLocation(job({ locationText: 'Austin, TX', workplaceType: 'hybrid' })).remoteMode).toBe('hybrid')
    expect(processLocation(job({ locationText: 'Austin, TX', isRemote: true })).remoteMode).toBe('remote')
    expect(processLocation(job({ locationText: 'Remote - US' })).remoteMode).toBe('remote')
  })
})

describe('processLocation: CA, DE and IN after a city are US states unless the city says otherwise', () => {
  it('stores "San Francisco, CA" and "Foster City, CA" as the US, not Canada (seen live 2026-11-09)', () => {
    expect(processLocation(job({ locationText: 'San Francisco, CA', salaryCurrency: 'USD' })).countryCode).toBe('US')
    expect(processLocation(job({ locationText: 'San Francisco, CA', isRemote: true })).countryCode).toBe('US')
    expect(processLocation(job({ locationText: 'Foster City, CA', salaryCurrency: 'USD', workplaceType: 'hybrid' })).countryCode).toBe('US')
    expect(processLocation(job({ locationText: 'US-CA-Menlo Park', salaryCurrency: 'USD', workplaceType: 'hybrid' })).countryCode).toBe('US')
    expect(processLocation(job({ locationText: 'Wilmington, DE', salaryCurrency: 'USD' })).countryCode).toBe('US')
    expect(processLocation(job({ locationText: 'Indianapolis, IN', salaryCurrency: 'USD' })).countryCode).toBe('US')
  })

  it('keeps Canada, Germany and India for their own cities, or when the pay currency agrees', () => {
    expect(processLocation(job({ locationText: 'Toronto, CA', salaryCurrency: 'CAD' })).countryCode).toBe('CA')
    expect(processLocation(job({ locationText: 'Montreal, CA' })).countryCode).toBe('CA')
    expect(processLocation(job({ locationText: 'Kitchener, CA', salaryCurrency: 'CAD' })).countryCode).toBe('CA')
    expect(processLocation(job({ locationText: 'Berlin, DE', salaryCurrency: 'EUR' })).countryCode).toBe('DE')
    expect(processLocation(job({ locationText: 'Frankfurt, DE', salaryCurrency: 'EUR' })).countryCode).toBe('DE')
    expect(processLocation(job({ locationText: 'Bangalore, IN', salaryCurrency: 'INR' })).countryCode).toBe('IN')
  })

  it('reads a city written alone as a city, so a remote Berlin job is German', () => {
    const r = processLocation(job({ locationText: 'Berlin', isRemote: true }))
    expect(r.countryCode).toBe('DE')
    expect(r.city).toBe('Berlin')
  })
})

describe('processLocation remote job country', () => {
  const remote = (locationText: string, salaryCurrency: string) => processLocation(job({ locationText, salaryCurrency, isRemote: true }))

  // 2026-11-19 audit: these remote jobs had a wrong or no country, so they were missing from the country and region
  // filters and their JobPosting applicantLocationRequirements were wrong.
  it('reads a country named anywhere in the text', () => {
    expect(remote('Remote from Spain', 'EUR').countryCode).toBe('ES')
    expect(remote('Remote (USA), strong preference for East Coast', 'USD').countryCode).toBe('US')
    expect(remote('Allentown, Pennsylvania', 'USD').countryCode).toBe('US')
    expect(remote('United States-Pennsylvania-Philadelphia', 'USD').countryCode).toBe('US')
  })

  it('reads a bare trailing CA as California with dollar pay, Canada otherwise', () => {
    expect(remote('Remote, CA', 'USD').countryCode).toBe('US')
    expect(remote('Remote, CA', 'CAD').countryCode).toBe('CA')
    expect(remote('Remote - Canada', 'CAD').countryCode).toBe('CA')
  })

  it('never takes a remote country from the pay currency alone, and keeps "Remote ..." out of the city', () => {
    expect(remote('Remote', 'USD').countryCode).toBeNull()
    expect(remote('Remote - EMEA', 'EUR').countryCode).toBeNull()
    expect(remote('Remote from Spain', 'EUR').city).toBeNull()
    expect(remote('Remote (USA), strong preference for East Coast', 'USD').city).toBeNull()
  })
})
