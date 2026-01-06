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
})

