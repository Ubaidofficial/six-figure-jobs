import { COMPANY_WEBSITE_CORRECTIONS, websiteUpdatesFor } from '../../lib/companies/websiteCorrections'

describe('COMPANY_WEBSITE_CORRECTIONS', () => {
  it('lists bare lower-case domains (no scheme, www or path)', () => {
    for (const domain of Object.values(COMPANY_WEBSITE_CORRECTIONS)) {
      expect(domain).toMatch(/^(?!www\.)([a-z0-9-]+\.)+[a-z]{2,}$/)
    }
  })
})

describe('websiteUpdatesFor', () => {
  // Live on 2026-11-10: Grafana Labs' tile drew a letter, its stored logo was img.logo.dev/grafana-labs.com.
  it('replaces a slug-guessed website and drops the logo.dev logo for it', () => {
    expect(
      websiteUpdatesFor('grafana.com', { website: 'https://grafana-labs.com', logoUrl: 'https://img.logo.dev/grafana-labs.com?token=x' }),
    ).toEqual({ website: 'https://grafana.com', logoUrl: null })
  })

  // ZoomInfo Technologies LLC had no website; logo.dev has no logo for that name.
  it('fills a missing website and keeps a correct or non-logo.dev logo', () => {
    expect(websiteUpdatesFor('zoominfo.com', { website: null, logoUrl: null })).toEqual({ website: 'https://zoominfo.com' })
    expect(websiteUpdatesFor('grafana.com', { website: 'https://www.grafana.com/', logoUrl: 'https://img.logo.dev/grafana.com?token=x' })).toEqual({})
    expect(websiteUpdatesFor('grafana.com', { website: 'https://grafana.com', logoUrl: 'https://cdn.example.com/g.png' })).toEqual({})
  })
})
