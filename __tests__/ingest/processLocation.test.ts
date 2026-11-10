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

  it('keeps the on-site mode and city for a job whose country was found from its state', () => {
    const r = processLocation(job({ locationText: 'Nürnberg, Bayern', salaryCurrency: 'EUR' }))
    expect(r.countryCode).toBe('DE')
    expect(r.remoteMode).toBe('onsite')
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
