import { normalizeRole } from '../../lib/normalizers/role'
import { isCanonicalSlug } from '../../lib/roles/canonicalSlugs'

const role = (title: string) => normalizeRole(title).roleSlug

describe('normalizeRole', () => {
  it('keeps a title that is already a role page', () => {
    expect(role('Senior Software Engineer')).toBe('senior-software-engineer')
    expect(role('Data Scientist')).toBe('data-scientist')
  })

  // Live titles that were all filed as "other" on 2026-11-08.
  it('falls back to the base role when the seniority form has no page', () => {
    expect(role('Lead Data Engineer')).toBe('data-engineer')
    expect(role('Product Manager')).toBe('product-manager')
  })

  it('files a title by the role its words name, keeping seniority when that page exists', () => {
    expect(role('Senior Full-Stack Developer')).toBe('senior-full-stack-engineer')
    expect(role('Sr. Product Manager, L&I')).toBe('senior-product-manager')
    expect(role('Software Engineer, Backend')).toBe('backend-engineer')
    expect(role('Python Developer')).toBe('software-engineer')
    expect(role('Cybersecurity Engineer')).toBe('security-engineer')
    expect(role('Projektleiter Hochbau (m/w/d)')).toBe('project-manager')
    expect(role('Controller:in (m/w/d)')).toBe('controller')
  })

  it('reads "Member of Technical Staff" as a software engineer, not the staff level', () => {
    expect(role('Member of Technical Staff, Robotics & Embodied AI Research')).toBe('software-engineer')
    expect(role('Member of Technical Staff, Full Stack')).toBe('full-stack-engineer')
  })

  it('files leaders and managers only under leadership and manager roles', () => {
    expect(role('Engineering Manager, Site Reliability Engineering')).toBe('engineering-manager')
    expect(role('Director of Marketing & Communications')).toBe('marketing-director')
    expect(role('Chief Financial Officer')).toBe('cfo')
    expect(role('Director, Data Analytics')).toBe('other')
  })

  it('leaves titles with no matching role page as "other"', () => {
    expect(role('Facharzt (m/w/d)')).toBe('other')
    expect(role('Senior Mechanical Engineer')).toBe('other')
    expect(role('Supervisor, Quality Assurance (Starlink Aviation)')).toBe('other')
  })

  it('only ever returns a role page', () => {
    const titles = ['Senior Full-Stack Developer', 'Lead Cloud Architect', 'VP of Finance and Accounting', 'Staff DevSecOps Engineer', 'Senior Buchhalter (m/w/d)']
    for (const t of titles) expect(isCanonicalSlug(role(t))).toBe(true)
  })
})
