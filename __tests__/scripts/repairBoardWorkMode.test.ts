import { planRepair } from '../../scripts/repairBoardWorkMode'

const base = { source: 'board:freehire', remote: false, remoteMode: 'onsite', descriptionHtml: '<p>This is a hybrid role, based in Amsterdam, with two office days a week.</p>' }

describe('planRepair', () => {
  it('moves a board job stored on-site to hybrid when its own sentence says hybrid, and keeps the sentence', () => {
    const plan = planRepair(base)
    expect(plan?.mode).toBe('hybrid')
    expect(plan?.quote).toContain('hybrid role')
  })

  it('moves it to remote when the posting says it is remote', () => {
    expect(planRepair({ ...base, descriptionHtml: '<p>Location: Remote within the United States.</p>' })?.mode).toBe('remote')
  })

  it('never touches an employer ATS value, a stored remote or hybrid, or a job already flagged remote', () => {
    expect(planRepair({ ...base, source: 'ats:greenhouse' })).toBeNull()
    expect(planRepair({ ...base, remoteMode: 'remote' })).toBeNull()
    expect(planRepair({ ...base, remoteMode: 'hybrid' })).toBeNull()
    expect(planRepair({ ...base, remoteMode: null })).toBeNull()
    expect(planRepair({ ...base, remote: true })).toBeNull()
  })

  it('does nothing when the posting says nothing clear, or says on-site', () => {
    expect(planRepair({ ...base, descriptionHtml: '<p>We are a growing team of engineers.</p>' })).toBeNull()
    expect(planRepair({ ...base, descriptionHtml: null })).toBeNull()
    expect(planRepair({ ...base, descriptionHtml: '<p>This role is based in our London office, in-person attendance expected 5 days per week.</p>' })).toBeNull()
  })

  it('does not read a negated remote claim as remote', () => {
    expect(planRepair({ ...base, descriptionHtml: '<p>This position is not remote.</p>' })).toBeNull()
  })

  it('does not call a job remote when the sentence offers remote beside another way of working', () => {
    for (const quote of [
      'Hybrid in London (UK) or Remote within the UK',
      'This role is based in Chicago or remote within the US.',
      'LOCATION: PASADENA, CA OR REMOTE WITHIN THE US',
      'Location: Remote/Cobec Site - DC',
      'This role is remote-friendly.',
      'Location: fully remote is fine; onsite is preferred, at our Mission Bay waterfront office.',
      'Location: Remote, but if local to San Mateo, CA - Hybrid',
    ]) {
      expect(planRepair({ ...base, descriptionHtml: `<p>${quote}</p>` })?.mode).not.toBe('remote')
    }
  })

  it('still reads plain remote sentences as remote', () => {
    for (const quote of ['Location: Remote within the United States', 'This is a remote role.', 'Remote within the United States, with Boston as the primary location.', 'Location: Remote, preferred Boston, MA or Dayton, OH', 'The starting pay range for this remote role is $105,840-$196,000.']) {
      expect(planRepair({ ...base, descriptionHtml: `<p>${quote}</p>` })?.mode).toBe('remote')
    }
  })
})
