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
  it('still reads a base range that also mentions bonus or equity after it', () => {
    expect(read('Pay Range : $ 100,000 - $150,000 + Bonus Potential & Participation in our Competitive Long-Term Incentive (LTI) Program.')).toMatchObject({ min: 100000, max: 150000 })
    expect(read('Compensation range: $140k-180k plus stock options, 401k match, medical, FSA, HSA and dental.')).toMatchObject({ min: 140000, max: 180000 })
    expect(read('Annual compensation of $120,000–$135,000, plus bonus.')).toMatchObject({ min: 120000, max: 135000 })
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
    // The four wrong readings found in the first 34 real ones (2026-11-15):
    ['total compensation with commissions', 'We offer a highly competitive compensation package of an estimated annual total compensation: $200,000 - $350,000+ (Including Base Salary, Commissions, Performance-Based Bonuses, and Additional Incentives)'],
    ['OTE', '$200k–$300k OTE'],
    ['OTE after a pay word', 'Salary: $200k–$300k OTE with uncapped commission.'],
    ['earning potential', 'Competitive Compensation ($100k-$150k+ Yearly Potential for Top Performers)'],
    ['pay per visit', 'OT: $80 per routine visit, or an annual salary option of $100,000–$120,000 based on caseload'],
  ])('%s', (_name, html) => {
    expect(read(html)).toBeNull()
  })
})

// Wrong readings found in the freehire sync's quality report, 2026-11-18/19 (runs 44423652371 and earlier): the figure was
// pay including bonus or incentive pay, which is not a base salary, or a range stated in US dollars was stored as CAD.
describe('readPayFromDescription: a figure that includes bonus or incentive pay is not a base salary', () => {
  it.each([
    ['Annual Salary Range Including Bonuses: $105,000 - $135,000'],
    ['The expected compensation range for this position is $145,676 - $178,049, which includes base pay plus variable incentive pay, if eligible.'],
    ['The estimated salary range for a new hire into this position is €81,900 - €134,550 which may include potential sales incentive payments (if applicable).'],
    ['For roles located in the US, the estimated salary range for this position is $109,800 to $175,700 USD per year, which may include potential sales incentive payments (if applicable).'],
    ['Salary range: $120,000 - $150,000, inclusive of annual bonus.'],
  ])('%s', (sentence) => {
    expect(read(sentence)).toBeNull()
  })

  it('still reads a base that excludes the bonus, or with the bonus on top', () => {
    expect(read('A reasonable estimate of the current salary range for this role is $130,000 - $150,000 per year not inclusive of bonus potential.')).toMatchObject({ min: 130000, max: 150000 })
    expect(read('The position includes a competitive salary of £95,000–£115,000 and a discretionary annual bonus.')).toMatchObject({ min: 95000, max: 115000, currency: 'GBP' })
    expect(read('For positions in this location, we offer a base pay of $163,380 - $269,570 , plus equity (when applicable), variable/incentive compensation and benefits.')).toMatchObject({ min: 163380, max: 269570 })
    expect(read('The base salary range for this full-time position is $110,000 - 130,000 plus commission.')).toMatchObject({ min: 110000, max: 130000 })
  })
})

describe('readPayFromDescription: a US-dollar range for a job abroad', () => {
  it('reads "USD" written after the amounts, even for a job in Canada', () => {
    expect(read('The US yearly salary range for this role is: $129,000 - $238,000 USD in addition to competitive perks & benefits.', { countries: ['ca'] })).toMatchObject({ currency: 'USD' })
  })
  it('gives no answer when the sentence names two dollars', () => {
    expect(read('Base salary: $150,000 - $180,000 USD or $190,000 - $230,000 CAD.')).toBeNull()
  })
})
