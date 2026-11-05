import { resolveJobRoleSlug, similarJobsKeyword } from '../../lib/roles/indexableRole'

describe('resolveJobRoleSlug', () => {
  it('uses the stored role when it is indexable', () => {
    expect(resolveJobRoleSlug({ roleSlug: 'software-engineer', title: 'Whatever' })).toBe('software-engineer')
  })

  it('reads the role from the title when the stored slug is "other" (non-canonical titles are stored that way)', () => {
    const other = (title: string) => resolveJobRoleSlug({ roleSlug: 'other', title })
    expect(other('Senior Staff Software Engineer, Ads Content Safety AI/ML')).toBe('software-engineer')
    expect(other('Sr. Analytics Engineer')).toBe('analytics-engineer')
    expect(other('Engineering Manager, Maps')).toBe('engineering-manager')
    expect(other('Partner Solutions Engineer, gTech Ads Sellside')).toBe('solutions-engineer')
  })

  it('does not believe a fuzzy match whose words are not together in the title', () => {
    expect(resolveJobRoleSlug({ roleSlug: 'other', title: 'UX Writer and Content Designer, Google Ads' })).toBeNull()
    expect(resolveJobRoleSlug({ roleSlug: 'other', title: 'Legal Deployment Strategist' })).toBeNull()
    expect(resolveJobRoleSlug({ roleSlug: 'other', title: 'Psychiatric Mental Health Nurse Practitioner - New Clinic Opening!' })).toBeNull()
  })

  it('returns null with no usable role or title', () => {
    expect(resolveJobRoleSlug({ roleSlug: null, title: '' })).toBeNull()
    expect(resolveJobRoleSlug({})).toBeNull()
  })
})

describe('similarJobsKeyword', () => {
  it('keeps the title head without seniority', () => {
    expect(similarJobsKeyword('Senior Staff Software Engineer, Ads Content Safety')).toBe('software engineer')
    expect(similarJobsKeyword('Legal Deployment Strategist')).toBe('legal deployment strategist')
  })

  it('gives nothing when one word is left, which would match far too much', () => {
    expect(similarJobsKeyword('Senior Engineer')).toBeNull()
    expect(similarJobsKeyword('')).toBeNull()
    expect(similarJobsKeyword(null)).toBeNull()
  })
})
