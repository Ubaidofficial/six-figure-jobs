// The remote100k coverage audit's matching (scripts/auditRemote100kCoverage.ts): an apply link on a company's own
// careers site still names the careers system's job id, which our job ids end with.
import { atsJobId, normCompany, normTitle, normUrl } from '../../scripts/auditRemote100kCoverage'

describe('remote100k coverage matching', () => {
  it.each([
    ['https://www.hubspot.com/careers/jobs/8397522?gh_jid=8397522&ref=remote100k', '8397522'],
    ['https://job-boards.eu.greenhouse.io/veeamsoftware/jobs/4981974101?ref=remote100k', '4981974101'],
    ['https://jobs.ashbyhq.com/webflow/4078c63c-4251-4c85-9615-851a0956ec51?ref=remote100k', '4078c63c-4251-4c85-9615-851a0956ec51'],
    ['https://www.docker.com/career-openings/?ashby_jid=06c27122-b11c-406f-b5e5-e468e999f548&ref=remote100k', '06c27122-b11c-406f-b5e5-e468e999f548'],
    ['https://jobs.lever.co/wpromote/52f7af5c-8803-41af-b4d3-3afd936e90bd?ref=remote100k', '52f7af5c-8803-41af-b4d3-3afd936e90bd'],
    ['https://beigene.wd5.myworkdayjobs.com/BeiGene/job/Remote-US/Regional-Clinical-Study-Manager_R37097?ref=remote1', 'r37097'],
    ['https://careers.cisco.com/global/en/job/CISCISGLOBAL2030240EXTERNALENGLOBAL/x', null],
  ])('%s -> %s', (url, id) => expect(atsJobId(url)).toBe(id))

  it('normalises names, titles and links', () => {
    expect(normCompany('Acme, Inc.')).toBe('acme')
    expect(normTitle('Sr. Engineer (Remote - US)')).toBe('sr engineer')
    expect(normUrl('https://www.example.com/jobs/1/?ref=x#a')).toBe('example.com/jobs/1')
  })
})
