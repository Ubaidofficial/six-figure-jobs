import { enrichAtIngest } from '../../lib/ingest/enrichAtIngest'

const base = { title: 'Senior Backend Engineer', sourceHasSkills: false, remoteMode: null, isRemote: false }

describe('enrichAtIngest', () => {
  it('reads the tech stack and skills from the posting', () => {
    const out = enrichAtIngest({ ...base, descriptionHtml: '<p>You will build services in Python and TypeScript on AWS with PostgreSQL.</p>' })
    expect(JSON.parse(out.techStack!)).toEqual(expect.arrayContaining(['Python']))
    expect(JSON.parse(out.skillsJson!).length).toBeGreaterThan(0)
  })

  it('keeps the source’s own skills: no skillsJson when the source gave some', () => {
    const out = enrichAtIngest({ ...base, sourceHasSkills: true, descriptionHtml: '<p>We use Python daily.</p>' })
    expect(out.techStack).toBeDefined()
    expect(out.skillsJson).toBeUndefined()
  })

  it('sets remoteMode to remote only from a stated sentence and only when empty', () => {
    const html = '<p>This role is fully remote and open across Europe.</p>'
    expect(enrichAtIngest({ ...base, descriptionHtml: html }).remoteMode).toBe('remote')
    expect(enrichAtIngest({ ...base, remoteMode: 'hybrid', descriptionHtml: html }).remoteMode).toBeUndefined()
    expect(enrichAtIngest({ ...base, remoteMode: 'onsite', descriptionHtml: html }).remoteMode).toBeUndefined()
    expect(enrichAtIngest({ ...base, isRemote: true, descriptionHtml: html }).remoteMode).toBeUndefined()
  })

  it('never reads a negation or a contradiction as remote, and never applies hybrid or on-site', () => {
    expect(enrichAtIngest({ ...base, descriptionHtml: '<p>This is not a remote role.</p>' }).remoteMode).toBeUndefined()
    expect(enrichAtIngest({ ...base, descriptionHtml: '<p>This is a hybrid role with three days a week in the office.</p>' }).remoteMode).toBeUndefined()
  })

  it('does nothing for a job with no description', () => {
    expect(enrichAtIngest({ ...base, descriptionHtml: null })).toEqual({})
  })
})
