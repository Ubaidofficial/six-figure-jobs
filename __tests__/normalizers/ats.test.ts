import { detectAtsFromUrl } from '../../lib/normalizers/ats'

describe('detectAtsFromUrl', () => {
  it('normalizes regional greenhouse board hosts', () => {
    expect(detectAtsFromUrl('https://job-boards.eu.greenhouse.io/imc')).toEqual({
      provider: 'greenhouse',
      atsUrl: 'https://boards.greenhouse.io/imc',
    })
  })

  it('normalizes workday job and login URLs to board roots', () => {
    expect(
      detectAtsFromUrl(
        'https://target.wd5.myworkdayjobs.com/targetcareers/login?redirect=%2Ftargetcareers%2FuserHome',
      ),
    ).toEqual({
      provider: 'workday',
      atsUrl: 'https://target.wd5.myworkdayjobs.com/targetcareers',
    })

    expect(
      detectAtsFromUrl(
        'https://nike.wd1.myworkdayjobs.com/nke/job/Metzingen-Baden-Wrttemberg/Role_R-81196/apply',
      ),
    ).toEqual({
      provider: 'workday',
      atsUrl: 'https://nike.wd1.myworkdayjobs.com/nke',
    })
  })

  it('rejects breezy asset hosts', () => {
    expect(detectAtsFromUrl('https://assets-cdn.breezy.hr/favicon_192.png')).toBeNull()
  })
})
