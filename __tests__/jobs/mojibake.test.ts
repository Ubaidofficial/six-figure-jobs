import { fixMojibake } from '../../lib/jobs/mojibake'

describe('fixMojibake', () => {
  it('repairs UTF-8 read as Windows-1252', () => {
    expect(fixMojibake('Senior Engineer â€” Remote')).toBe('Senior Engineer — Remote')
    expect(fixMojibake('cafÃ© and naÃ¯ve')).toBe('café and naïve')
    expect(fixMojibake('Weâ€™re hiring â€œbuildersâ€\u009d')).toBe('We’re hiring “builders”')
    expect(fixMojibake('Salary: â‚¬90k')).toBe('Salary: €90k')
  })

  it('leaves clean text alone, including real accents and symbols', () => {
    for (const text of ['Plain ASCII', 'Zoë and café', 'Ünal at Müller GmbH', '€90k — remote', 'Ã']) {
      expect(fixMojibake(text)).toBe(text)
    }
  })

  it('repairs only the garbled part of mixed text', () => {
    expect(fixMojibake('Real é then â€” garbled')).toBe('Real é then — garbled')
  })

  it('handles empty input', () => {
    expect(fixMojibake(null)).toBe('')
    expect(fixMojibake(undefined)).toBe('')
    expect(fixMojibake('')).toBe('')
  })
})
