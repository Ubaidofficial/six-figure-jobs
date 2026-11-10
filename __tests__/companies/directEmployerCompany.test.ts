import { companyUpdatesFor } from '../../lib/companies/directEmployerCompany'
import type { DirectEmployer } from '../../lib/constants/directEmployers'

const scale: DirectEmployer = { slug: 'scale-ai', name: 'Scale AI', provider: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/scaleai', website: 'scale.com' }
const row = (over: Partial<{ atsProvider: string | null; atsUrl: string | null; website: string | null; logoUrl: string | null }>) => ({
  atsProvider: 'greenhouse',
  atsUrl: 'https://boards.greenhouse.io/scaleai',
  website: null,
  logoUrl: null,
  ...over,
})

describe('companyUpdatesFor', () => {
  it('fills a missing website from the employer domain', () => {
    expect(companyUpdatesFor(scale, row({}))).toEqual({ website: 'https://scale.com' })
  })

  it('keeps a website on the employer domain', () => {
    expect(companyUpdatesFor(scale, row({ website: 'https://www.scale.com' }))).toEqual({})
    expect(companyUpdatesFor(scale, row({ website: 'https://scale.com/careers' }))).toEqual({})
  })

  // Live on 2026-11-10: Scale AI's stored website was the slug-guessed "scale-ai.com", so its logo stayed a letter.
  it('replaces a website on another domain with the checked one', () => {
    expect(companyUpdatesFor(scale, row({ website: 'https://scale-ai.com' }))).toEqual({ website: 'https://scale.com' })
  })

  // Live on 2026-11-09: /companies drew a letter for Scale AI, its stored logo was img.logo.dev/scale-ai.com.
  it('drops a stored logo.dev logo for another domain, keeps one for the right domain or another source', () => {
    expect(companyUpdatesFor(scale, row({ website: 'https://scale.com', logoUrl: 'https://img.logo.dev/scale-ai.com?token=x' }))).toEqual({ logoUrl: null })
    expect(companyUpdatesFor(scale, row({ website: 'https://scale.com', logoUrl: 'https://img.logo.dev/scale.com?token=x' }))).toEqual({})
    expect(companyUpdatesFor(scale, row({ website: 'https://scale.com', logoUrl: 'https://cdn.example.com/scale.png' }))).toEqual({})
  })

  it('updates the board when it moved, and leaves logos alone for an employer without a domain', () => {
    const noSite = { ...scale, website: undefined, boardUrl: 'https://jobs.ashbyhq.com/scale', provider: 'ashby' as const }
    expect(companyUpdatesFor(noSite, row({ logoUrl: 'https://img.logo.dev/scale-ai.com?token=x' }))).toEqual({
      atsProvider: 'ashby',
      atsUrl: 'https://jobs.ashbyhq.com/scale',
    })
  })
})
