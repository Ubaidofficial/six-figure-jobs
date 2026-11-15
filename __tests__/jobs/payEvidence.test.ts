import { readPayFromDescription } from '@/lib/jobs/payEvidence'

const read = (html: string, ctx = {}) => readPayFromDescription(html, ctx)

describe('readPayFromDescription: reads a yearly range and hands back the sentence', () => {
  it('reads a US pay-transparency range', () => {
    const r = read('<p>Role overview.</p><p>The base salary range for this position is $150,000 - $180,000 per year.</p>')
    expect(r).toMatchObject({ min: 150000, max: 180000, currency: 'USD', period: 'year' })
    expect(r?.quote).toContain('$150,000 - $180,000')
  })
  it('reads k amounts, "to", codes and other currencies', () => {
    expect(read('Compensation: $150k to $190k annually.')).toMatchObject({ min: 150000, max: 190000, currency: 'USD' })
    expect(read('Salary range: USD 140,000 - 160,000 a year.')).toMatchObject({ min: 140000, max: 160000, currency: 'USD' })
    expect(read('The salary is £90,000 – £110,000 depending on experience.')).toMatchObject({ min: 90000, max: 110000, currency: 'GBP' })
    expect(read('Salary: €85.000 - €105.000 gross per year')).toMatchObject({ min: 85000, max: 105000, currency: 'EUR' })
  })
  it('combines pay by location into one wide range, so the gate judges the lowest tier', () => {
    const r = read('<li>Salary for SF and NYC: $160,000 - $200,000</li><li>Salary for other US locations: $140,000 - $180,000</li>')
    expect(r).toMatchObject({ min: 140000, max: 200000, currency: 'USD' })
  })
  it('tells which dollar from the job or the sentence', () => {
    expect(read('Salary range $120,000 - $150,000 CAD per year.')).toMatchObject({ currency: 'CAD' })
    expect(read('Base salary: $120,000 - $150,000', { countries: ['ca'] })).toMatchObject({ currency: 'CAD' })
    expect(read('Base salary: $120,000 - $150,000', { countries: ['de'] })).toBeNull()
  })
})

describe('readPayFromDescription: leaves alone what is not a yearly salary', () => {
  it.each([
    ['hourly', 'The pay range is $45 - $60 per hour.'],
    ['hourly with big numbers', 'Compensation is $90,000 - $120,000 per hour of billable work'],
    ['monthly', 'Salary: $12,000 - $15,000 per month.'],
    ['day rate', 'Salary range $500 - $700 per day.'],
    ['bonus', 'Compensation includes a sign-on bonus of $50,000 - $75,000 for senior hires.'],
    ['equity', 'Compensation also includes equity valued at $200,000 - $400,000.'],
    ['company funding', 'We raised $50,000,000 - $80,000,000 across rounds; compensation is competitive.'],
    ['no pay word', 'Our revenue grew from $10,000,000 to $40,000,000 last year.'],
    ['a single figure', 'Base salary of $150,000.'],
    ['too small', 'Salary range $20,000 - $30,000.'],
    ['absurd spread', 'Salary range $50,000 - $400,000.'],
    ['two currencies', 'Salary $150,000 - $180,000 in the US; £90,000 - £110,000 in the UK.'],
    ['no range, only the word', 'Competitive salary and great benefits.'],
  ])('%s', (_name, html) => {
    expect(read(html)).toBeNull()
  })
})
