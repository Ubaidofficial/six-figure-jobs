import { roleFacetsFromRows } from '../../lib/jobs/roleFacets'

const row = (roleSlug: string | null, n: number) => ({ roleSlug, _count: { _all: n } })

describe('roleFacetsFromRows', () => {
  it('counts a role with every role that contains it, as the role filter matches', () => {
    const rows = [row('software-engineer', 546), row('senior-software-engineer', 600), row('staff-software-engineer', 215), row('data-engineer', 90), row(null, 7)]
    expect(roleFacetsFromRows(rows)).toEqual([
      { value: 'software-engineer', count: 1361 },
      { value: 'senior-software-engineer', count: 600 },
      { value: 'staff-software-engineer', count: 215 },
      { value: 'data-engineer', count: 90 },
    ])
  })

  it('keeps the top N and breaks ties by name', () => {
    expect(roleFacetsFromRows([row('b', 1), row('a', 1), row('c', 5)], 2)).toEqual([
      { value: 'c', count: 5 },
      { value: 'a', count: 1 },
    ])
  })
})
