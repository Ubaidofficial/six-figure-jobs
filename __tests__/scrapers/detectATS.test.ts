import { SUPPORTED_ATS_PROVIDERS, isSupportedAtsProvider } from '../../lib/scrapers/ats/types'
import { detectATS, toAtsProvider } from '../../lib/scrapers/utils/detectATS'

describe('ATS detection support boundaries', () => {
  it('only coerces scraper-supported ATS types into AtsProvider', () => {
    expect(toAtsProvider('greenhouse')).toBe('greenhouse')
    expect(toAtsProvider('breezy')).toBe('breezy')
    expect(toAtsProvider('teamtailor')).toBe('teamtailor')
    expect(toAtsProvider('generic')).toBeNull()
  })

  it('detects newly supported ATS families explicitly', () => {
    expect(detectATS('https://retail-zipline.breezy.hr/p/example')).toBe('breezy')
    expect(detectATS('https://jobs.teamtailor.com/companies/acme/jobs/123')).toBe('teamtailor')
    expect(detectATS('https://careers.example.icims.com/jobs/1234')).toBe('icims')
    expect(detectATS('https://jobs.personio.com/job/123')).toBe('personio')
    expect(detectATS('https://example.wd3.oraclecloud.com/hcmUI/CandidateExperience')).toBe('oraclecloud')
    expect(detectATS('https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html')).toBe('workforcenow')
    expect(isSupportedAtsProvider('breezy')).toBe(true)
    expect(isSupportedAtsProvider('teamtailor')).toBe(true)
  })

  it('keeps the supported provider registry aligned with implemented scrapers', () => {
    expect(SUPPORTED_ATS_PROVIDERS).toEqual([
      'greenhouse',
      'lever',
      'ashby',
      'workday',
      'bamboohr',
      'smartrecruiters',
      'recruitee',
      'workable',
      'teamtailor',
      'breezy',
    ])
  })
})
