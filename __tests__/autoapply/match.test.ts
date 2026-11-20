import { matchJob, seniorityLabel, skillLabel } from '@/lib/autoapply/match'

const designer = `Jane Doe — Senior Product Designer
Senior Product Designer, Acme (2021–now): led the design system in Figma, prototyping and user interviews.
Product Designer, Beta (2018–2021): mobile app design, prototyping.`

describe('résumé match', () => {
  it('scores a close match high and says why', () => {
    const m = matchJob(designer, { title: 'Senior Product Designer', experienceLevel: 'senior', skills: ['Figma', 'design-systems', 'Prototyping', 'User research', 'Motion'] })
    expect(m.matched).toEqual(['Figma', 'Prototyping'])
    expect(m.reasons).toEqual(['2 of 5 skills on your résumé', 'your résumé names this role', 'Senior-level, like your résumé'])
    expect(m.score).toBeGreaterThanOrEqual(60)
    expect(m.label).toMatch(/Good|Strong/)
  })

  it('matches skills as whole words, in either spelling of a slug', () => {
    const m = matchJob('Built APIs in Node.js and Go; Kubernetes; design systems', { title: 'Backend Engineer', skills: ['node.js', 'go', 'kubernetes', 'design-systems', 'rust'] })
    expect(m.matched).toEqual(['node.js', 'go', 'kubernetes', 'design-systems'])
    // "go" must not match inside another word.
    expect(matchJob('Google, MongoDB', { title: 'Engineer', skills: ['go'] }).matched).toEqual([])
  })

  it('reads a skill at the end of a sentence (the full stop is not part of it)', () => {
    expect(matchJob('I do prototyping. And Figma.', { title: 'Designer', skills: ['Prototyping', 'Figma', '.NET'] }).matched).toEqual(['Prototyping', 'Figma'])
    expect(matchJob('Built services in .NET and Node.js.', { title: 'Engineer', skills: ['.NET', 'node.js'] }).matched).toEqual(['.NET', 'node.js'])
  })

  it('scores an unrelated job low', () => {
    const m = matchJob(designer, { title: 'Staff Backend Engineer', experienceLevel: 'staff', skills: ['Go', 'Kubernetes', 'PostgreSQL'] })
    expect(m.score).toBeLessThan(35)
    expect(m.label).toBe('Low match')
    expect(m.reasons[0]).toBe('0 of 3 skills on your résumé')
    expect(m.reasons).toContain('one level above your résumé')
  })

  it('does not read the verb "lead" or someone else\'s VP title as the person\'s level', () => {
    const resume = 'Software Engineer at Acme. I lead the migration project and reported to the VP. Python, AWS.'
    const m = matchJob(resume, { title: 'Senior Software Engineer', experienceLevel: 'senior', skills: ['Python'] })
    expect(m.reasons.join(' ')).not.toMatch(/level/)
  })

  it('reads the person\'s own VP title, not one they reported to', () => {
    const job = { title: 'VP of Engineering', experienceLevel: 'vp', skills: [] }
    expect(matchJob('VP of Engineering at Acme (2020-now).', job).reasons).toContain('VP-level, like your résumé')
    expect(matchJob('Engineering Manager at Acme, reported to the VP of Engineering.', job).reasons.join(' ')).not.toMatch(/VP-level/)
  })

  it('works when the job lists no skills, and never leaves 0-100', () => {
    const m = matchJob(designer, { title: 'Product Designer', skills: [] })
    expect(m.reasons).not.toContain(expect.stringMatching(/skills/))
    expect(m.score).toBeGreaterThan(0)
    expect(m.score).toBeLessThanOrEqual(100)
    expect(matchJob('', { title: '', skills: [] }).score).toBeGreaterThanOrEqual(0)
  })
})

describe('card labels', () => {
  it('names the seniority, but not the "mid" default', () => {
    expect(seniorityLabel('senior', 'Senior Product Designer')).toBe('Senior')
    expect(seniorityLabel('lead', 'Design Lead')).toBe('Lead')
    expect(seniorityLabel('mid', 'Product Designer')).toBeNull()
    expect(seniorityLabel(null, 'Staff Software Engineer')).toBe('Staff')
  })
  it('turns skill slugs into readable names and keeps names that have case', () => {
    expect(skillLabel('design-systems')).toBe('Design systems')
    expect(skillLabel('TypeScript')).toBe('TypeScript')
  })
})
