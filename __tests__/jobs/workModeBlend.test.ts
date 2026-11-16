import { FLEX_PATTERN, blendMerge, blendOffsets, blendPicks } from '../../lib/jobs/workModeBlend'

describe('blendPicks', () => {
  it('follows the pattern while both streams have jobs: three of five positions are remote or hybrid', () => {
    expect(blendPicks(0, 10, 100, 100)).toEqual(['flex', 'flex', 'other', 'flex', 'other', 'flex', 'flex', 'other', 'flex', 'other'])
    expect(FLEX_PATTERN.filter((p) => p === 'F').length).toBe(3)
  })

  it('gives the positions of a stream that has run out to the other, and never exceeds the total', () => {
    const picks = blendPicks(0, 50, 2, 6)
    expect(picks.length).toBe(8)
    expect(picks.filter((p) => p === 'flex').length).toBe(2)
    expect(picks.filter((p) => p === 'other').length).toBe(6)
    expect(blendPicks(0, 10, 0, 4)).toEqual(['other', 'other', 'other', 'other'])
    expect(blendPicks(0, 10, 3, 0)).toEqual(['flex', 'flex', 'flex'])
    expect(blendPicks(0, 10, 0, 0)).toEqual([])
  })

  it('a page is the same slice of the whole list, wherever it starts', () => {
    const all = blendPicks(0, 40, 17, 23)
    for (const [from, count] of [[0, 10], [10, 10], [20, 10], [30, 10], [7, 13]]) expect(blendPicks(from, count, 17, 23)).toEqual(all.slice(from, from + count))
  })
})

describe('blendOffsets', () => {
  it('says where to start reading each stream for a page', () => {
    const before = blendPicks(0, 20, 100, 100)
    const o = blendOffsets(20, 100, 100)
    expect(o.flex).toBe(before.filter((p) => p === 'flex').length)
    expect(o.flex + o.other).toBe(20)
  })

  it('counts the hand-over when one stream is short', () => {
    expect(blendOffsets(6, 2, 10)).toEqual({ flex: 2, other: 4 })
  })
})

describe('blendMerge', () => {
  it('lists every job once, each stream in its own pay order, remote and hybrid up front', () => {
    const flex = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6']
    const other = ['O1', 'O2', 'O3', 'O4']
    const picks = blendPicks(0, 10, flex.length, other.length)
    const merged = blendMerge(picks, flex, other)
    expect([...merged].sort()).toEqual([...flex, ...other].sort())
    expect(merged.filter((x) => x.startsWith('F'))).toEqual(flex)
    expect(merged.filter((x) => x.startsWith('O'))).toEqual(other)
    expect(merged.slice(0, 5)).toEqual(['F1', 'F2', 'O1', 'F3', 'O2'])
  })

  it('walks a whole list page by page with no job lost or repeated', () => {
    const flex = Array.from({ length: 23 }, (_, i) => `F${i}`)
    const other = Array.from({ length: 37 }, (_, i) => `O${i}`)
    const pageSize = 8
    const seen: string[] = []
    for (let page = 1; page <= Math.ceil(60 / pageSize); page++) {
      const skip = (page - 1) * pageSize
      const off = blendOffsets(skip, flex.length, other.length)
      const picks = blendPicks(skip, pageSize, flex.length, other.length)
      const nf = picks.filter((p) => p === 'flex').length
      seen.push(...blendMerge(picks, flex.slice(off.flex, off.flex + nf), other.slice(off.other, off.other + (picks.length - nf))))
    }
    expect(seen.length).toBe(60)
    expect(new Set(seen).size).toBe(60)
  })
})
