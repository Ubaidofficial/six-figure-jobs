import { mergeByPostingDate } from '../../lib/jobs/queryJobs'

const d = (iso: string) => new Date(iso)

describe('"Most Recent" order (mergeByPostingDate)', () => {
  // Dated jobs use the employer's posting date; undated ones the day we first saw them. Each list is newest first.
  const dated = [
    { id: 'posted-nov-9', at: d('2026-11-09') },
    { id: 'posted-nov-1', at: d('2026-11-01') },
    { id: 'posted-2023', at: d('2023-12-09') }, // an old posting we only found yesterday stays at the end
  ]
  const undated = [
    { id: 'seen-nov-10', at: d('2026-11-10') },
    { id: 'seen-nov-5', at: d('2026-11-05') },
  ]

  it('orders by posting date across both lists', () => {
    expect(mergeByPostingDate(dated, undated, 0, 10)).toEqual([
      'seen-nov-10',
      'posted-nov-9',
      'seen-nov-5',
      'posted-nov-1',
      'posted-2023',
    ])
  })

  it('returns the requested page only', () => {
    expect(mergeByPostingDate(dated, undated, 2, 2)).toEqual(['seen-nov-5', 'posted-nov-1'])
    expect(mergeByPostingDate(dated, undated, 4, 2)).toEqual(['posted-2023'])
    expect(mergeByPostingDate(dated, undated, 6, 2)).toEqual([])
  })

  it('puts the dated job first on a tie', () => {
    const at = d('2026-11-08')
    expect(mergeByPostingDate([{ id: 'dated', at }], [{ id: 'undated', at }], 0, 2)).toEqual(['dated', 'undated'])
  })
})
