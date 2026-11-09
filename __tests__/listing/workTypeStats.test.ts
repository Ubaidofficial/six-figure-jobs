import { workTypeStats } from '../../lib/listing/workTypeStats'

const hrefFor = (mode: string) => `/jobs?remoteMode=${mode}`

describe('workTypeStats', () => {
  it('lists remote, hybrid and on-site with their counts and nofollow links', () => {
    expect(workTypeStats({ remote: 11, hybrid: 3, onsite: 1 }, hrefFor)).toEqual([
      { label: 'remote roles', count: 11, href: '/jobs?remoteMode=remote', nofollow: true },
      { label: 'hybrid roles', count: 3, href: '/jobs?remoteMode=hybrid', nofollow: true },
      { label: 'on-site roles', count: 1, href: '/jobs?remoteMode=onsite', nofollow: true },
    ])
  })

  it('returns nothing when a work type is already chosen', () => {
    expect(workTypeStats({ remote: 11, hybrid: 3, onsite: 1 }, hrefFor, 'remote')).toEqual([])
  })

  it('keeps zero counts so the header can decide to hide them', () => {
    expect(workTypeStats({ remote: 0, hybrid: 0, onsite: 0 }, hrefFor).every((s) => s.count === 0)).toBe(true)
  })
})
