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

  it('does not guess for a euro or dollar job with only a city', () => {
    expect(processLocation(job({ locationText: 'Munich', salaryCurrency: 'EUR' })).countryCode).toBeNull()
    expect(processLocation(job({ locationText: 'Springfield', salaryCurrency: 'USD' })).countryCode).toBeNull()
    expect(processLocation(job({ locationText: 'Vienna', salaryCurrency: 'EUR' })).countryCode).toBeNull()
  })

  it('keeps the on-site mode and city for a job whose country was found from its state', () => {
    const r = processLocation(job({ locationText: 'Nürnberg, Bayern', salaryCurrency: 'EUR' }))
    expect(r.countryCode).toBe('DE')
    expect(r.remoteMode).toBe('onsite')
  })
})
