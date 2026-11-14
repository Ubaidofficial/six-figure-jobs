import { experienceLabel, findExperienceRequirement } from '../../lib/jobs/experienceRequirement'

const find = (html: string) => findExperienceRequirement(html)

describe('findExperienceRequirement', () => {
  it('reads "5+ years", ranges and plain years, with the sentence', () => {
    expect(find('<li>5+ years of experience in backend engineering</li>')).toMatchObject({ minYears: 5, maxYears: null, openEnded: true })
    expect(find('<p>3-5 years of hands-on experience with Python.</p>')).toMatchObject({ minYears: 3, maxYears: 5, openEnded: false })
    expect(find('<p>Minimum of 7 years experience in sales.</p>')).toMatchObject({ minYears: 7, maxYears: null, openEnded: false })
    expect(find('<p>At least 4 yrs of professional experience.</p>')?.sentence).toBe('At least 4 yrs of professional experience.')
  })

  it('takes the largest stated minimum', () => {
    expect(find('<p>10+ years of experience in professional services, including 5+ years leading teams.</p>')?.minYears).toBe(10)
    expect(find('<ul><li>8+ years of experience in the industry</li><li>3+ years of experience managing people</li></ul>')?.minYears).toBe(8)
  })

  it('skips preferences, ceilings and company history', () => {
    expect(find('<p>Nice to have: 10+ years of experience with Kubernetes.</p>')).toBeNull()
    expect(find('<p>An entry-level role with up to 2 years of experience.</p>')).toBeNull()
    expect(find('<p>Founded 15 years ago, we have a long history and experience in payments.</p>')).toBeNull()
    expect(find('<p>For over 20 years we have built our brand and our experience.</p>')).toBeNull()
  })

  it('needs the sentence to be about experience, and a plausible number', () => {
    expect(find('<p>Our offices opened 5 years ago and we have 3 locations.</p>')).toBeNull()
    expect(find('<p>40 years of experience required.</p>')).toBeNull()
    expect(find(null)).toBeNull()
  })

  it('labels the requirement', () => {
    expect(experienceLabel({ minYears: 5, maxYears: null, openEnded: true, sentence: '' })).toBe('5+ yrs experience')
    expect(experienceLabel({ minYears: 3, maxYears: 5, openEnded: false, sentence: '' })).toBe('3-5 yrs experience')
    expect(experienceLabel({ minYears: 7, maxYears: null, openEnded: false, sentence: '' })).toBe('7 yrs experience')
  })
})
