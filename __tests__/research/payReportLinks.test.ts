import { EDITION_2026_11 as R } from '@/lib/research/editions/2026-11'
import { cityHref, employerHref, levelHref, roleHref, skillHref, uniqueHrefs } from '@/lib/research/payReportLinks'
import { SKILL_TARGETS } from '@/lib/seo/pseoTargets'

describe('where report rows link', () => {
  it('links a role only when its slug is a canonical role (the role page redirects anything else)', () => {
    expect(roleHref('Principal software engineer')).toBe('/jobs/principal-software-engineer')
    expect(roleHref('Engineering manager')).toBe('/jobs/engineering-manager')
    expect(roleHref('Chief of staff to the founder')).toBeUndefined()
    expect(R.roles.map((x) => roleHref(x.label)).every(Boolean)).toBe(true) // all 12 November roles have a page
  })

  it('links a city only when it has a city page', () => {
    expect(cityHref('San Francisco')).toBe('/jobs/city/san-francisco')
    expect(cityHref('san jose')).toBe('/jobs/city/san-jose')
    expect(cityHref('San Mateo')).toBeUndefined()
    expect(cityHref('Sunnyvale')).toBeUndefined()
  })

  it('links the levels that have a page, and not Director, VP or Principal (no matching page)', () => {
    expect(levelHref('Senior')).toBe('/jobs/level/senior')
    expect(levelHref('Lead')).toBe('/jobs/level/lead')
    expect(levelHref('Staff')).toBe('/jobs/level/lead') // the "Lead / Staff" page
    for (const label of ['Director', 'VP', 'Principal']) expect(levelHref(label)).toBeUndefined()
  })

  it('links a skill only when it has a skill page', () => {
    const known = SKILL_TARGETS[0]
    expect(skillHref(known.label)).toBe(`/jobs/skills/${known.slug}`)
    expect(skillHref('Zzyzx framework')).toBeUndefined()
  })

  it('links an employer only when the data carries its own slug, and only a plain slug', () => {
    expect(employerHref({ slug: 'nvidia' })).toBe('/company/nvidia')
    expect(employerHref({ slug: 'capital-one' })).toBe('/company/capital-one')
    expect(employerHref({})).toBeUndefined()
    for (const bad of ['../admin', 'Capital One', 'a/b', 'x?y=1', '']) expect(employerHref({ slug: bad })).toBeUndefined()
  })

  it('keeps one link per destination in a table', () => {
    expect(uniqueHrefs(['/a', '/b', '/a', undefined, '/b', '/c'])).toEqual(['/a', '/b', undefined, undefined, undefined, '/c'])
    const levels = uniqueHrefs(R.seniority.map((x) => levelHref(x.label)))
    expect(levels.filter(Boolean)).toEqual(['/jobs/level/senior', '/jobs/level/lead'])
  })

  it('never adds a query string or fragment: a parameter on an internal link would make the listing page noindex', () => {
    const all = [
      ...R.roles.map((x) => roleHref(x.label)),
      ...R.cities.map((x) => cityHref(x.label)),
      ...R.seniority.map((x) => levelHref(x.label)),
      employerHref({ slug: 'nvidia' }),
    ].filter((h): h is string => Boolean(h))
    expect(all.length).toBeGreaterThan(10)
    for (const href of all) expect(href).not.toMatch(/[?#]/)
  })
})
