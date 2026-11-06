import { buildLogoUrl } from '../../lib/companies/logo'
import { needsDarkTile } from '../../lib/companies/logoFallback'
import { isJobPortalHost, normalizePublicCompanyWebsite } from '../../lib/companies/website'

// Hosts that appeared as the "website" of many unrelated employers in the live-site snapshot.
const BOARD_HOSTS = [
  'seek.com.au', 'xing.com', 'cadremploi.fr', 'candidat.francetravail.fr', 'free-work.com',
  'welcometothejungle.com', 'ats.welcometothejungle.com', 'irecruitings.betterteam.com', 'arc.dev',
  'startup.jobs', 'kubernetesjobs.com', 'workwise.io', 'arbeitnow.co.uk', 'arbeitnow.nl', 'jobs.rocket-match.de', 'remote.com',
  'civilservicejobs.service.gov.uk', 'careers.vic.gov.au', 'adzuna.co.uk', 'adzuna.com.au', 'adzuna.de',
  'adzuna.com',
]
const ATS_HOSTS = [
  'workforcenow.adp.com', 'myjobs.adp.com', 'recruiting.ultipro.com', 'recruiting2.ultipro.ca',
  'recruiting.paylocity.com', 'secure7.saashr.com', 'secure.entertimeonline.com', 'recruitingbypaycor.com',
  'paycomonline.net', 'prd01-hcm01.prd.mykronos.com', 'mycompass.rec.pro.ukg.net', 'jobs.dayforcehcm.com',
  'jobs.gusto.com', 'ats.rippling.com', 'hdow.fa.us6.oraclecloud.com', 'natsenrout.jobs.hr.cloud.sap',
  'rpigroup.applytojob.com', 'ironsidehr.zohorecruit.com', 'goldbelt.jibeapply.com',
  'forgegroupllc.isolvedhire.com', 'jungheinrich.onlyfy.jobs', 'app.trinethire.com', 'app.loxo.co',
  'app.dover.com', 'adsquare.jobs.personio.com', 'www.careers-page.com', 'wd12.myworkdaysite.com',
]
const EMPLOYER_HOSTS = [
  'stripe.com', 'okta.com', 'adp.com', 'paylocity.com', 'ukg.com', 'oracle.com', 'gusto.com', 'rippling.com',
  'dover.com', 'xingfoundation.org', 'seekingalpha.com', 'remotelyrics.com', 'arcteryx.com', 'jobs.tonyschocolonely.com',
  'careers.google.com', 'careers.microsoft.com', 'rocket-lab.com', 'linkedin.com', 'adzunalabs.io', 'cesiumastro.com',
]

describe('job boards and hosted ATS portals are never an employer website', () => {
  it.each([...BOARD_HOSTS, ...ATS_HOSTS])('%s is classified as a portal', (host) => {
    expect(isJobPortalHost(host)).toBe(true)
    expect(normalizePublicCompanyWebsite(host)).toBeNull()
    expect(normalizePublicCompanyWebsite(`https://${host}/jobs/123`)).toBeNull()
  })

  it.each(EMPLOYER_HOSTS)('%s is left alone', (host) => {
    expect(isJobPortalHost(host)).toBe(false)
    if (host !== 'linkedin.com') expect(normalizePublicCompanyWebsite(host)).toBe(`https://${host}`)
  })
})

describe('logo derivation never uses a portal logo', () => {
  it('falls back to a name lookup (and so to initials) for a company whose website is a portal', () => {
    for (const host of [...BOARD_HOSTS, ...ATS_HOSTS]) {
      expect(buildLogoUrl(null, `https://${host}`, 'Acme Ltd')).toBe('/logo/name/Acme%20Ltd')
    }
  })

  it('still derives the logo from a real employer website', () => {
    expect(buildLogoUrl(null, 'https://okta.com', 'Okta')).toBe('/logo/domain/okta.com')
    expect(buildLogoUrl(null, 'https://www.adp.com', 'ADP')).toBe('/logo/domain/adp.com')
  })

  it('ignores a stored logo.dev or Clearbit URL that is keyed to a portal, keeps the rest', () => {
    expect(buildLogoUrl('https://img.logo.dev/xing.com?token=pk_x', null, 'Acme')).toBe('/logo/name/Acme')
    expect(buildLogoUrl('https://logo.clearbit.com/seek.com.au', null, 'Acme')).toBe('/logo/name/Acme')
    expect(buildLogoUrl('https://img.logo.dev/xing.com?token=pk_x', 'https://acme.io', 'Acme')).toBe('/logo/domain/acme.io')
    expect(buildLogoUrl('https://img.logo.dev/linkedin.com?token=pk_x', null, 'LinkedIn')).toContain('img.logo.dev/linkedin.com')
    expect(buildLogoUrl('https://img.logo.dev/name/Acme?token=pk_x', null, 'Acme')).toContain('img.logo.dev/name/Acme')
  })
})

describe('needsDarkTile', () => {
  it('flags the known white-on-transparent logos by company name', () => {
    expect(needsDarkTile('Okta')).toBe(true)
    expect(needsDarkTile('Okta, Inc.')).toBe(true)
    expect(needsDarkTile('CesiumAstro')).toBe(true)
  })

  it('leaves every other company on the white tile', () => {
    expect(needsDarkTile('Oktane Events')).toBe(false)
    expect(needsDarkTile('Cesium')).toBe(false)
    expect(needsDarkTile('Stripe')).toBe(false)
    expect(needsDarkTile('')).toBe(false)
    expect(needsDarkTile(null)).toBe(false)
  })
})
