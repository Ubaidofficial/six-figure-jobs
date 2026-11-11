import { activeFilterChips, multiParam } from '../../lib/jobs/activeFilters'
import { salaryFilterCurrency, salaryFilterLabel } from '../../lib/jobs/salaryFilter'

const params = (qs: string) => new URLSearchParams(qs)
const labels = (qs: string, pinned?: string[]) => activeFilterChips(params(qs), pinned).map((c) => c.label)

describe('salary filter currency', () => {
  it('compares in the selected country’s currency, US dollars otherwise', () => {
    expect(salaryFilterCurrency('GB')).toBe('GBP')
    expect(salaryFilterCurrency('de')).toBe('EUR')
    expect(salaryFilterCurrency('')).toBe('USD')
    expect(salaryFilterCurrency('CH')).toBe('USD') // no mapping: the page also compares in USD
  })

  it('labels amounts with the currency symbol', () => {
    expect(salaryFilterLabel(150_000, 'GBP')).toBe('£150k+')
    expect(salaryFilterLabel(200_000, 'USD')).toBe('$200k+')
    expect(salaryFilterLabel(250_000, 'CAD')).toBe('C$250k+')
  })
})

describe('active filter chips', () => {
  it('shows nothing without filters (the $100k+ floor is not a filter)', () => {
    expect(labels('')).toEqual([])
    expect(labels('minSalary=100000&page=2&sort=salary')).toEqual([])
  })

  it('names each filter as the panel does, in the panel’s order', () => {
    expect(
      labels('remoteMode=remote&minSalary=200000&country=GB&role=software-engineer&seniority=senior&companySize=51-200&tech=Go&visa=1'),
    ).toEqual(['£200k+', 'Remote', 'UK', 'Software Engineer', 'Senior', '51–200 employees', 'Go', 'Visa sponsorship'])
  })

  it('gives one chip per value of a repeatable filter, comma-separated or repeated', () => {
    expect(labels('role=data-engineer,product-manager&role=data-engineer')).toEqual(['Data Engineer', 'Product Manager'])
    expect(multiParam(params('seniority=staff&seniority=lead,staff'), 'seniority')).toEqual(['staff', 'lead'])
  })

  it('names remote regions and the keyword', () => {
    expect(labels('remoteRegion=global&q=rust')).toEqual(['“rust”', 'Anywhere in the world'])
  })

  it('leaves out what the page itself pins', () => {
    expect(labels('country=DE&remoteMode=hybrid', ['country'])).toEqual(['Hybrid'])
  })
})
