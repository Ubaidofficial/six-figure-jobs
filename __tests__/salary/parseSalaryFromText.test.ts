import { normalizeSalary, parseSalaryFromText, validateHighSalaryEligibility } from '../../lib/normalizers/salary'

describe('parseSalaryFromText – interval proximity hardening', () => {
  it('does not treat "hourly employees" as an hourly salary interval', () => {
    const parsed = parseSalaryFromText(
      'Join 7M+ users worldwide. You will lead a team that manages hourly employees across multiple sites.'
    )

    expect(parsed).not.toBeNull()
    expect(parsed?.interval).toBe('year')
  })

  it('detects hourly interval when a money token is present nearby', () => {
    const parsed = parseSalaryFromText('Pay: $150 per hour')

    expect(parsed).not.toBeNull()
    expect(parsed?.interval).toBe('hour')
    expect(parsed?.min).toBe(150)
    expect(parsed?.max).toBe(150)
  })
})

describe('validateHighSalaryEligibility – description cap', () => {
  it('rejects description-derived salaries above $600k USD', () => {
    const normalized = normalizeSalary({
      min: 800_000,
      max: 800_000,
      currency: 'USD',
      interval: 'year',
    })

    const validation = validateHighSalaryEligibility({
      normalized,
      source: 'descriptionText',
    })

    expect(validation.salaryValidated).toBe(false)
    expect(validation.salaryParseReason).toBe('capped_description')
  })

  it('allows valid high salaries from salaryRaw (hourly annualized)', () => {
    const normalized = normalizeSalary({
      min: 150,
      max: 150,
      currency: 'USD',
      interval: 'hour',
    })

    const validation = validateHighSalaryEligibility({
      normalized,
      source: 'salaryRaw',
    })

    expect(validation.salaryValidated).toBe(true)
    expect(validation.salaryParseReason).toBe('ok')
  })

  it('rejects junior and intern titles even when salary is above threshold', () => {
    const normalized = normalizeSalary({
      min: 150_000,
      max: 180_000,
      currency: 'USD',
      interval: 'year',
    })

    const validation = validateHighSalaryEligibility({
      normalized,
      source: 'ats',
      title: 'Junior Software Engineer',
    })

    expect(validation.salaryValidated).toBe(false)
    expect(validation.salaryRejectedReason).toBe('banned-title:intern-junior-entry')
  })
})

describe('salary parsing edge cases (v2.10)', () => {
  it('parses common six-figure notations across currencies', () => {
    const usdCompact = parseSalaryFromText('Compensation: USD 100k base')
    const usdFull = parseSalaryFromText('Salary range: USD 100,000 annual')
    const usdRaw = parseSalaryFromText('Guaranteed pay 100000 USD')
    const gbp = parseSalaryFromText('Base salary £100k')
    const eur = parseSalaryFromText('Compensation €120k')

    expect(usdCompact?.min).toBe(100_000)
    expect(usdFull?.max).toBe(100_000)
    expect(usdRaw?.max).toBe(100_000)
    expect(gbp?.currency).toBe('GBP')
    expect(gbp?.max).toBe(100_000)
    expect(eur?.currency).toBe('EUR')
    expect(eur?.max).toBe(120_000)
  })

  it('treats ambiguous "$100k" with no country signal as non-validated', () => {
    const parsed = parseSalaryFromText('Compensation up to $100k')
    const normalized = normalizeSalary({
      min: parsed?.min ?? null,
      max: parsed?.max ?? null,
      currency: parsed?.currency ?? null,
      interval: parsed?.interval ?? 'year',
    })
    const validated = validateHighSalaryEligibility({
      normalized,
      source: 'salaryRaw',
      currencyAmbiguous: parsed?.currency == null,
    })

    expect(parsed?.max).toBe(100_000)
    expect(parsed?.currency).toBeNull()
    expect(validated.salaryValidated).toBe(false)
    expect(validated.salaryParseReason).toBe('ambiguous')
  })

  it('accepts ranges where max crosses threshold (80k–120k)', () => {
    const normalized = normalizeSalary({
      min: 80_000,
      max: 120_000,
      currency: 'USD',
      interval: 'year',
    })
    const validated = validateHighSalaryEligibility({
      normalized,
      source: 'salaryRaw',
    })

    expect(validated.salaryValidated).toBe(true)
    expect(validated.salaryParseReason).toBe('ok')
  })

  it('annualizes hourly rates before threshold checks', () => {
    const normalized = normalizeSalary({
      min: 60,
      max: 60,
      currency: 'USD',
      interval: 'hour',
    })
    const validated = validateHighSalaryEligibility({
      normalized,
      source: 'salaryRaw',
    })

    expect(Number(normalized.minAnnual)).toBe(124_800)
    expect(validated.salaryValidated).toBe(true)
  })

  it('rejects missing salary values', () => {
    const normalized = normalizeSalary({
      min: null,
      max: null,
      currency: 'USD',
      interval: 'year',
    })
    const validated = validateHighSalaryEligibility({
      normalized,
      source: 'salaryRaw',
    })

    expect(validated.salaryValidated).toBe(false)
    expect(validated.salaryParseReason).toBe('bad_range')
  })

  it('rejects noisy OTE/base+commission blends when range is too wide', () => {
    const parsed = parseSalaryFromText('OTE $110k ($90k base + $20k commission)')
    const normalized = normalizeSalary({
      min: parsed?.min ?? null,
      max: parsed?.max ?? null,
      currency: parsed?.currency ?? null,
      interval: parsed?.interval ?? 'year',
    })
    const validated = validateHighSalaryEligibility({
      normalized,
      source: 'descriptionText',
      currencyAmbiguous: parsed?.currency == null,
    })

    expect(parsed).not.toBeNull()
    expect(validated.salaryValidated).toBe(false)
    expect(['bad_range', 'ambiguous']).toContain(validated.salaryParseReason)
  })
})
