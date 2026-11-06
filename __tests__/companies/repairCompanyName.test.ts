import { boardSlugFromUrl, looksLikeIdName, nameFromDescription, prettySlug, relinkToRepairedCompany, repairCompanyName } from '../../lib/companies/repairCompanyName'

// Every "bad" name below is a real company name from freehire that was live on the site on 2026-11-06.
describe('looksLikeIdName', () => {
  it.each([
    '9c26369c-d400-4eb7-a9b3-ab8f6469f9e8',
    'neatdevs-llc-7d0fa42a-132d-4c14-8d7f-acadebdcd4ad',
    '2ced86f3-42cd-4204-8c6d-28c3d154bfb2:19000101_000001',
    '8a788267536ec009015376c7bcda018f',
    'pod6.app.loxo.co/inara-talent',
    'app.loxo.co/reliance-one-1',
    'icfcjb.fa.ocs.oraclecloud.com/CX',
    'weber.wd115.myworkdayjobs.com/WB',
    'activefence/d5.005',
    'akina.catsone.com',
  ])('flags %s', (name) => expect(looksLikeIdName(name)).toBe(true))

  it.each([
    'Amplitude',
    'Cantor Fitzgerald/BGC',
    'Impact.com',
    'monday.com',
    'C3.ai',
    'U.S.Bank',
    'S&P Global',
    'Block, Inc.',
    'accenturefederalservices',
    'iwoca',
    '3M',
    'Scale AI',
    '',
  ])('leaves %p alone', (name) => expect(looksLikeIdName(name)).toBe(false))
})

describe('prettySlug', () => {
  it('turns a slug into a name, keeps company suffixes right, and drops ids and trailing counters', () => {
    expect(prettySlug('neatdevs-llc')).toBe('Neatdevs LLC')
    expect(prettySlug('neatdevs-llc-7d0fa42a-132d-4c14-8d7f-acadebdcd4ad')).toBe('Neatdevs LLC')
    expect(prettySlug('sage-veterinary-imaging-07e81227-32b5-482d-9fc0-c99bc9ad2f96')).toBe('Sage Veterinary Imaging')
    expect(prettySlug('reliance-one-1')).toBe('Reliance One')
    expect(prettySlug('acme-gmbh')).toBe('Acme GmbH')
  })

  it('refuses site codes, which are not names', () => {
    expect(prettySlug('CX')).toBeNull()
    expect(prettySlug('WB')).toBeNull()
    expect(prettySlug('d5.005')).toBeNull()
  })
})

describe('boardSlugFromUrl', () => {
  it('reads the company handle from ATS board URLs', () => {
    expect(boardSlugFromUrl('https://jobs.ashbyhq.com/amplitude/70e2f3f0-71fd-473e-9c69-c6ed937ca57d')).toBe('amplitude')
    expect(boardSlugFromUrl('https://job-boards.greenhouse.io/impact/jobs/5828526002')).toBe('impact')
    expect(boardSlugFromUrl('https://jobs.lever.co/palantir/abc')).toBe('palantir')
    expect(boardSlugFromUrl('https://weber.wd115.myworkdayjobs.com/WB/job/Providence-Utah/Sr-IT-Security-Manager_JR157')).toBe('weber')
  })

  it('returns null for other URLs, and for ids', () => {
    expect(boardSlugFromUrl('https://careers.google.com/jobs/1')).toBeNull()
    expect(boardSlugFromUrl('https://jobs.ashbyhq.com/9c26369c-d400-4eb7-a9b3-ab8f6469f9e8/x')).toBeNull()
    expect(boardSlugFromUrl('not a url')).toBeNull()
    expect(boardSlugFromUrl(null)).toBeNull()
  })
})

describe('nameFromDescription', () => {
  it('reads the company from an opening "X is …" sentence', () => {
    expect(nameFromDescription('<p>Amplitude is the leading AI analytics platform, helping over 5,200 customers.</p>')).toBe('Amplitude')
    expect(nameFromDescription('<p>NeatDevs LLC is a small federal subcontractor.</p>')).toBe('NeatDevs LLC')
    // a heading and the sentence after it are read separately, never run together ("Acme Robotics Acme Robotics")
    expect(nameFromDescription('<h2>About Acme Robotics</h2><p>Acme Robotics builds robots.</p>')).toBe('Acme Robotics')
    expect(nameFromDescription('<p>Dell Technologies is a global leader.</p>')).toBe('Dell Technologies')
  })

  it('does not take a sentence that is not about a company', () => {
    expect(nameFromDescription('<p>We are looking for an engineer.</p>')).toBeNull()
    expect(nameFromDescription('<p>The team is growing fast.</p>')).toBeNull()
    expect(nameFromDescription('<p>Join a company that is reintroducing itself.</p>')).toBeNull()
    expect(nameFromDescription('<p>Our mission is to help.</p>')).toBeNull()
    expect(nameFromDescription('')).toBeNull()
  })
})

describe('repairCompanyName', () => {
  it('returns a real name exactly as given', () => {
    expect(repairCompanyName({ name: 'Cantor Fitzgerald/BGC', applyUrl: 'https://x.oraclecloud.com/a' })).toBe('Cantor Fitzgerald/BGC')
    expect(repairCompanyName({ name: '  Stripe ' })).toBe('Stripe')
  })

  it('recovers the Amplitude name from its Ashby apply URL (the reported case)', () => {
    expect(
      repairCompanyName({
        name: '9c26369c-d400-4eb7-a9b3-ab8f6469f9e8',
        applyUrl: 'https://jobs.ashbyhq.com/amplitude/70e2f3f0-71fd-473e-9c69-c6ed937ca57d',
        descriptionHtml: '<p>Amplitude is the leading AI analytics platform.</p>',
      }),
    ).toBe('Amplitude')
  })

  it('falls back to the description when the URL has no board (the Amplitude description alone is enough)', () => {
    expect(
      repairCompanyName({
        name: '9c26369c-d400-4eb7-a9b3-ab8f6469f9e8',
        applyUrl: 'https://careers.example.com/job/1',
        descriptionHtml: '<p>Amplitude is the leading AI analytics platform.</p>',
      }),
    ).toBe('Amplitude')
  })

  it('uses what the name itself still says', () => {
    expect(repairCompanyName({ name: 'neatdevs-llc-7d0fa42a-132d-4c14-8d7f-acadebdcd4ad' })).toBe('Neatdevs LLC')
    expect(repairCompanyName({ name: 'app.loxo.co/reliance-one-1' })).toBe('Reliance One')
    expect(repairCompanyName({ name: 'activefence/d5.005' })).toBe('Activefence')
    expect(repairCompanyName({ name: 'weber.wd115.myworkdayjobs.com/WB', applyUrl: 'https://weber.wd115.myworkdayjobs.com/WB/job/x' })).toBe('Weber')
  })

  it('reads the employer out of a bare domain used as a name', () => {
    expect(repairCompanyName({ name: 'jobs.aecon.com' })).toBe('Aecon')
    expect(repairCompanyName({ name: 'iwoca.co.uk' })).toBe('Iwoca')
    expect(repairCompanyName({ name: 'akina.catsone.com' })).toBe('Akina')
  })

  it('does not take a platform tenant code for an employer (Oracle, ADP)', () => {
    expect(repairCompanyName({ name: 'icfcjb.fa.ocs.oraclecloud.com' })).toBeNull()
    expect(repairCompanyName({ name: 'workforcenow.adp.com' })).toBeNull()
  })

  it('returns null when nothing in the record names the employer, so the job is skipped instead of showing an id', () => {
    expect(
      repairCompanyName({
        name: 'icfcjb.fa.ocs.oraclecloud.com/CX',
        applyUrl: 'https://icfcjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/127723',
        descriptionHtml: "<p>Join a company that's reintroducing itself to the aviation community.</p>",
      }),
    ).toBeNull()
    expect(repairCompanyName({ name: '8a788267536ec009015376c7bcda018f', applyUrl: 'https://recruitingbypaycor.com/career/x' })).toBeNull()
    expect(repairCompanyName({ name: null })).toBeNull()
    expect(repairCompanyName({ name: '' })).toBeNull()
  })
})

describe('relinkToRepairedCompany', () => {
  const amplitude = { id: 'company-amplitude', name: 'Amplitude' }

  it('moves a job stored under an id to the real company, with the dedupe key that includes the new company', () => {
    expect(
      relinkToRepairedCompany({ company: '9c26369c-d400-4eb7-a9b3-ab8f6469f9e8', companyId: 'company-uuid' }, amplitude, 'amplitude:content-marketing-manager:sf'),
    ).toEqual({ company: 'Amplitude', companyId: 'company-amplitude', dedupeKey: 'amplitude:content-marketing-manager:sf' })
  })

  it('never moves a job that is stored under a real name, or is already on that company', () => {
    expect(relinkToRepairedCompany({ company: 'Stripe', companyId: 'company-stripe' }, amplitude, 'k')).toEqual({})
    expect(relinkToRepairedCompany({ company: 'accenturefederalservices', companyId: 'c1' }, amplitude, 'k')).toEqual({})
    expect(relinkToRepairedCompany({ company: '9c26369c-d400-4eb7-a9b3-ab8f6469f9e8', companyId: 'company-amplitude' }, amplitude, 'k')).toEqual({})
    expect(relinkToRepairedCompany({ company: null, companyId: null }, amplitude, 'k')).toEqual({})
  })
})
