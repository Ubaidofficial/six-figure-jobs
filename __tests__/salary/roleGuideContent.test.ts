import { summarizeRoleGuide, type GuideRow } from '../../lib/salary/roleGuide'
import { buildFaqs, buildGuideJsonLd, buildMetaDescription, buildTakeaways, formatGuideDate, formatPay } from '../../lib/salary/roleGuideContent'

const NOW = new Date('2026-11-06T10:00:00Z')
const mk = (i: number, over: Partial<GuideRow> = {}): GuideRow => ({
  minAnnual: 120_000 + i * 5_000,
  maxAnnual: 140_000 + i * 5_000,
  currency: 'USD',
  countryCode: 'US',
  experienceLevel: i % 2 ? 'senior' : 'mid',
  companyName: ['Stripe', 'Ramp', 'Databricks', 'Figma'][i % 4],
  companySlug: ['stripe', 'ramp', 'databricks', 'figma'][i % 4],
  updatedAt: NOW,
  ...over,
})
const full = summarizeRoleGuide(Array.from({ length: 40 }, (_, i) => mk(i)))
const thin = summarizeRoleGuide(Array.from({ length: 7 }, (_, i) => mk(i)))
const args = { roleName: 'Software Engineer', bandLabel: '$100k+', guide: full }

describe('formatting', () => {
  it('rounds pay to the nearest thousand and formats currencies', () => {
    expect(formatPay(162_437)).toBe('$162,000')
    expect(formatPay(162_600)).toBe('$163,000')
    expect(formatPay(100_000, 'GBP')).toBe('£100,000')
  })
  it('formats the date in UTC', () => {
    expect(formatGuideDate(new Date('2026-11-06T23:30:00Z'))).toBe('November 6, 2026')
  })
})

describe('takeaways', () => {
  it('lead with the median and the middle half, with the sample size', () => {
    const t = buildTakeaways(args)
    expect(t.length).toBeGreaterThanOrEqual(3)
    expect(t.length).toBeLessThanOrEqual(6)
    expect(t[0]).toBe(`The median advertised Software Engineer salary in our $100k+ listings is ${formatPay(full.usd!.median)} a year (USD, 40 live listings).`)
    expect(t[1]).toContain(`${formatPay(full.usd!.p25)} to ${formatPay(full.usd!.p75)}`)
  })

  it('name the companies with the most listings and the best-paid level', () => {
    const t = buildTakeaways(args).join('\n')
    expect(t).toMatch(/^[A-Za-z]+ \(10\), [A-Za-z]+ \(10\) and [A-Za-z]+ \(10\) have the most open \$100k\+ Software Engineer listings\.$/m) // three of the four tied companies, ties broken by median
    expect(t).toMatch(/Senior Software Engineer roles have the highest median/)
  })

  it('always say the sample is only listings at or above the band', () => {
    expect(buildTakeaways(args).at(-1)).toMatch(/only listings that publish a salary of \$100k\+ or more, so they sit above pay for Software Engineer roles overall/)
  })

  it('state no figure when the sample is too small', () => {
    const t = buildTakeaways({ ...args, guide: thin }).join('\n')
    expect(t).toContain('We track 7 live $100k+ Software Engineer listings, 7 of them in USD.')
    expect(t).toContain('shows no salary figures yet')
    expect(t).not.toMatch(/median advertised/)
    expect(t).not.toMatch(/\$\d{2,3},\d{3}/) // no dollar figure at all
  })

  it('say so when there are no listings', () => {
    expect(buildTakeaways({ ...args, guide: summarizeRoleGuide([]) })[0]).toContain('We have no live $100k+ Software Engineer listings right now.')
  })
})

describe('FAQ and structured data', () => {
  const faqs = buildFaqs(args)
  const ld = buildGuideJsonLd({ ...args, siteUrl: 'https://www.6figjobs.com', roleSlug: 'software-engineer', onetCode: '15-1252.00', faqs })
  const byType = (t: string) => ld.find((o) => o['@type'] === t) as any

  it('answers with the numbers on the page', () => {
    expect(faqs[0].question).toBe('How much does a Software Engineer make?')
    expect(faqs[0].answer).toContain(formatPay(full.usd!.median))
    expect(faqs.map((f) => f.question)).toEqual(expect.arrayContaining(['What is the salary range for a Software Engineer?', 'Where does this Software Engineer salary data come from?']))
    expect(faqs.find((f) => /Where does/.test(f.question))!.answer).toContain('November 6, 2026')
  })

  it('emits FAQPage JSON-LD with exactly the visible questions and answers', () => {
    const q = byType('FAQPage').mainEntity
    expect(q.map((x: any) => [x.name, x.acceptedAnswer.text])).toEqual(faqs.map((f) => [f.question, f.answer]))
  })

  it('reports real percentiles, not the minimum and maximum', () => {
    const d = byType('Occupation').estimatedSalary
    expect(d['@type']).toBe('MonetaryAmountDistribution')
    expect(d).toMatchObject({ currency: 'USD', duration: 'P1Y' })
    expect(d.percentile25).toBe(Math.round(full.usd!.p25 / 1000) * 1000)
    expect(d.median).toBe(Math.round(full.usd!.median / 1000) * 1000)
    expect(d.percentile75).toBe(Math.round(full.usd!.p75 / 1000) * 1000)
    expect(d.percentile10).toBeUndefined()
    expect(d.percentile90).toBeUndefined()
    expect(byType('Occupation').occupationalCategory).toBe('15-1252.00')
  })

  it('puts speakable inside a WebPage with the data date', () => {
    const page = byType('WebPage')
    expect(page.dateModified).toBe('2026-11-06T10:00:00.000Z')
    expect(page.speakable['@type']).toBe('SpeakableSpecification')
    expect(ld.some((o) => o['@type'] === 'SpeakableSpecification')).toBe(false) // it was a bare top-level object before
    expect(page.url).toBe('https://www.6figjobs.com/salary/software-engineer')
  })

  it('keeps the breadcrumb and offer, and omits salary fields without enough data', () => {
    expect(byType('BreadcrumbList').itemListElement).toHaveLength(3)
    expect(byType('AggregateOffer').offerCount).toBe(40)
    const none = buildGuideJsonLd({ ...args, guide: thin, siteUrl: 'https://www.6figjobs.com', roleSlug: 'software-engineer', faqs: buildFaqs({ ...args, guide: thin }), now: NOW })
    expect(none.find((o) => o['@type'] === 'Occupation')).not.toHaveProperty('estimatedSalary')
    expect(none.some((o) => o['@type'] === 'AggregateOffer')).toBe(false)
  })
})

describe('meta description', () => {
  it('leads with the median and the date', () => {
    expect(buildMetaDescription(args)).toBe(
      `Software Engineer salary: median ${formatPay(full.usd!.median)} a year, middle half ${formatPay(full.usd!.p25)} to ${formatPay(full.usd!.p75)}, from 40 live $100k+ listings. Updated November 2026.`,
    )
  })
  it('makes no numeric claim without data', () => {
    expect(buildMetaDescription({ ...args, guide: thin })).not.toMatch(/median/)
  })
})
