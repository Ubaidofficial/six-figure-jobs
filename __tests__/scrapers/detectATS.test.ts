import { SUPPORTED_ATS_PROVIDERS, isSupportedAtsProvider } from '../../lib/scrapers/ats/types'
import { detectATS, toAtsProvider } from '../../lib/scrapers/utils/detectATS'

describe('ATS detection support boundaries', () => {
  it('only coerces scraper-supported ATS types into AtsProvider', () => {
    expect(toAtsProvider('greenhouse')).toBe('greenhouse')
    expect(toAtsProvider('breezy')).toBeNull()
    expect(toAtsProvider('teamtailor')).toBeNull()
    expect(toAtsProvider('generic')).toBeNull()
  })

  it('keeps unsupported ATS detection distinct from supported providers', () => {
    expect(detectATS('https://retail-zipline.breezy.hr/p/example')).toBe('breezy')
    expect(detectATS('https://jobs.teamtailor.com/companies/acme/jobs/123')).toBe('teamtailor')
    expect(isSupportedAtsProvider('breezy')).toBe(false)
    expect(isSupportedAtsProvider('teamtailor')).toBe(false)
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
    ])
  })
})
