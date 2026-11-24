jest.mock('../../app/ubaid93/admin.module.css', () => ({}))

import { niceTicks } from '../../app/ubaid93/(dashboard)/charts'

describe('niceTicks', () => {
  it('gives whole-number steps that reach the maximum', () => {
    for (const max of [1, 2, 3, 7, 13, 99, 420, 2_500, 61_234]) {
      const ticks = niceTicks(max)
      expect(ticks.every(Number.isInteger)).toBe(true)
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max)
      expect(ticks.length).toBeLessThanOrEqual(6)
    }
    expect(niceTicks(1)).toEqual([0, 1])
    expect(niceTicks(0)).toEqual([0, 1])
  })
})
