import { readBenefitsEvidence } from '@/lib/jobs/benefitsEvidence'

const labels = (html: string) => readBenefitsEvidence(html).map((b) => b.label)

describe('readBenefitsEvidence: reads what the posting states and hands back the sentence', () => {
  it('reads unlimited / open PTO', () => {
    expect(labels('<p>We offer unlimited PTO and flexible hours.</p>')).toEqual(['Unlimited PTO'])
    expect(labels('Open vacation policy, take the time you need.')).toEqual(['Unlimited PTO'])
    expect(labels('Our PTO policy is unlimited.')).toEqual(['Unlimited PTO'])
  })

  it('reads a stated number of days or weeks of leave', () => {
    expect(labels('You get 25 days paid time off per year.')).toEqual(['25 days paid time off'])
    expect(labels('Benefits include 5 weeks vacation.')).toEqual(['5 weeks vacation'])
    expect(labels('<li>25 days of annual leave plus public holidays</li>')).toEqual(['25 days annual leave'])
    expect(labels('We give 20 vacation days a year.')).toEqual(['20 days vacation'])
    expect(labels('PTO: 20 days')).toEqual(['20 days paid time off'])
    expect(labels('Four weeks of paid vacation every year.')).toEqual(['4 weeks paid vacation'])
  })

  it('reads paid parental leave, with weeks when given', () => {
    expect(labels('We offer paid parental leave for all new parents.')).toEqual(['Paid parental leave'])
    expect(labels('16 weeks paid maternity leave and 8 weeks paid paternity leave')).toEqual(['16 weeks paid maternity leave'])
    expect(labels('We provide 16 weeks of paid parental leave.')).toEqual(['16 weeks paid parental leave'])
    expect(labels('Our maternity leave is fully paid.')).toEqual(['Paid maternity leave'])
    expect(labels('We offer 12 weeks of family leave to every employee.')).toEqual(['12 weeks family leave'])
    expect(labels('Paid maternity and paternity leave.')).toEqual(['Paid parental leave'])
  })

  it('reads 401(k), pension, health insurance, four-day week, learning budget and equity', () => {
    expect(labels('We offer a 401(k) with company match.')).toEqual(['401(k) match'])
    expect(labels('Benefits: 401k')).toEqual(['401(k)'])
    expect(labels('We provide a workplace pension scheme with employer contributions.')).toEqual(['Employer pension contribution'])
    expect(labels('We offer a pension plan.')).toEqual(['Pension'])
    expect(labels('We cover medical, dental and vision insurance for you and your family.')).toEqual(['Health insurance'])
    expect(labels('We operate a four-day work week for the whole company.')).toEqual(['Four-day work week'])
    expect(labels('We offer a 32-hour work week at full pay.')).toEqual(['32-hour work week'])
    expect(labels('You get a $2,000 annual learning budget.')).toEqual(['Learning budget'])
    expect(labels('We give you a professional development budget of $1,500.')).toEqual(['Learning budget'])
    expect(labels('Competitive salary + equity.')).toEqual(['Equity'])
    expect(labels('We offer stock options to every employee.')).toEqual(['Stock options'])
  })

  it('reads bullets under a Benefits heading, and quotes the heading when the line is very short', () => {
    const r = readBenefitsEvidence('<h3>Benefits</h3><ul><li>401(k)</li><li>Medical, dental and vision</li><li>Unlimited PTO</li></ul><h3>About us</h3><p>We build tools.</p>')
    expect(r.map((b) => b.label)).toEqual(['Unlimited PTO', 'Health insurance', '401(k)'])
    expect(r.find((b) => b.label === '401(k)')?.quote).toBe('Benefits ... 401(k)')
  })

  it('stops reading bullets as benefits when the section ends', () => {
    expect(labels('<h3>Benefits</h3><ul><li>Remote work</li></ul><h3>Requirements</h3><ul><li>Medical, dental and vision coverage knowledge</li></ul>')).toEqual([])
  })

  it('quotes are verbatim sentences from the posting', () => {
    const html = '<p>Great team.</p><p>We offer unlimited PTO and a 401(k) match.</p>'
    const r = readBenefitsEvidence(html)
    expect(r.map((b) => b.label)).toEqual(['Unlimited PTO', '401(k) match'])
    for (const b of r) expect(b.quote).toBe('We offer unlimited PTO and a 401(k) match.')
  })

  it('gives at most 12 items, one label per category', () => {
    const r = readBenefitsEvidence('We offer unlimited PTO. We offer open PTO. We offer a 401(k). We offer a 401(k) plan. We offer medical, dental and vision insurance.')
    expect(r.map((b) => b.label)).toEqual(['Unlimited PTO', 'Health insurance', '401(k)'])
    expect(r.length).toBeLessThanOrEqual(12)
  })

  it('reads plain text as well as HTML, and nothing from nothing', () => {
    expect(labels('We offer unlimited PTO.')).toEqual(['Unlimited PTO'])
    expect(readBenefitsEvidence(null)).toEqual([])
    expect(readBenefitsEvidence('')).toEqual([])
  })
})

describe('readBenefitsEvidence: leaves alone what is not a benefit', () => {
  it.each([
    // negation
    ['no unlimited PTO', 'We do not have unlimited PTO; time off is by request.'],
    ['no 401k', 'We do not offer 401k.'],
    ['no health insurance', 'No health insurance is provided for this role.'],
    ['unpaid parental leave', 'Parental leave is unpaid.'],
    ['not a four-day week', 'This is not a four-day work week role.'],
    // requirement lists
    ['own health insurance', 'Candidates must have their own health insurance.'],
    ['contractor pays own', 'As an independent contractor you are responsible for your own medical insurance.'],
    ['must be able to', 'You must be able to take 25 days paid time off per year.'],
    ['401k experience', 'Experience with 401(k) plan administration required.'],
    ['insurance experience', 'Health insurance experience required.'],
    ['stock options experience', 'Experience with stock options trading.'],
    // numbers that are not leave
    ['25 days notice', 'You must give 25 days notice before leaving.'],
    ['within 25 days', 'We respond within 25 days of your application.'],
    ['25 days to start', 'The role starts within 25 days of the offer, paid time off to be agreed.'],
    ['range', 'We offer 15-20 days paid time off.'],
    ['range with to', 'We offer 3 to 4 weeks vacation.'],
    ['up to', 'We offer up to 25 days paid time off.'],
    ['at least', 'At least 20 days of paid time off.'],
    ['a rate', 'You accrue 2 days of PTO per month.'],
    ['tenure tiers', 'You get 15 days of vacation, rising to 20 days after 3 years of service.'],
    ['sick days', 'We offer 12 days of paid sick time off.'],
    ['volunteer days', 'We offer 5 days of paid time off to volunteer.'],
    ['holidays only', 'We observe 10 paid holidays a year.'],
    // conditional, hedged, past, future
    ['conditional', 'If you work with us for a year you get unlimited PTO.'],
    ['hedged', 'Benefits may include a 401(k) match.'],
    ['some roles', 'Some roles offer a four-day work week.'],
    ['past', 'We used to offer unlimited PTO.'],
    ['exploring', 'We are exploring a four-day work week.'],
    ['after waiting period', 'You are eligible for health insurance after 90 days.'],
    ['question', 'Do you want unlimited PTO and a 401(k) match?'],
    // other meanings of the same words
    ['equity and inclusion', 'We care about diversity, equity and inclusion.'],
    ['equity alone', 'We are committed to equity and inclusion at work.'],
    ['private equity', 'You will join our private equity team and work on equity research.'],
    ['equity markets', 'Deep knowledge of equity markets and stock options pricing.'],
    ['equity administration', 'You will manage equity compensation plans for employees.'],
    ['pension customer', 'We build software for pension fund administrators and their clients.'],
    ['pension customer 2', 'Our clients offer a pension scheme to their members.'],
    ['pension industry', 'We offer services to the pension industry.'],
    ['401k customer', 'Our platform helps customers set up a 401(k) for their employees.'],
    ['health insurance industry', 'We are a health insurance company building software for carriers.'],
    ['insurance paperwork', 'You will receive 25 days notice of schedule changes and health insurance enrollment forms.'],
    ['insurance platform', 'Our platform lets customers compare health insurance plans.'],
    ['training budget owner', 'You will own the training budget for the team.'],
    ['four-day week for customers', 'We help clients move to a four-day work week.'],
    // legal / EEO boilerplate
    ['EEO', 'We are an equal opportunity employer and offer reasonable accommodations including unlimited PTO.'],
    ['required by law', 'We provide paid family leave as required by law.'],
    ['FMLA', 'You are eligible for 12 weeks of family leave under FMLA.'],
    // a benefit word with no employer offering it
    ['bare mention', 'Medical, dental and vision are important to many people.'],
    ['bare 401k', 'The 401(k) was introduced in 1978.'],
  ])('%s', (_name, html) => {
    expect(readBenefitsEvidence(html)).toEqual([])
  })

  it('ignores a legal section even when it mentions a benefit', () => {
    expect(labels('<h3>Equal Opportunity</h3><p>We offer unlimited PTO.</p>')).toEqual([])
  })

  it('gives no number when the posting states two different ones', () => {
    expect(labels('We offer 20 days paid time off. Senior staff get 25 days paid time off.')).toEqual([])
  })

  it('gives no number when it also says unlimited', () => {
    expect(labels('We offer unlimited PTO. We offer 20 days of PTO.')).toEqual([])
  })
})
