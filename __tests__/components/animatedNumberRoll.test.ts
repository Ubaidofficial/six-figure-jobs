// AnimatedNumber `roll` (owner's request, 2026-11-25): which digits roll when a live number changes, right to left.
import { rollSlots } from '@/components/ui/AnimatedNumber'

describe('rollSlots', () => {
  it('rolls only the digits that changed, right to left', () => {
    const s = rollSlots('25,418', '25,431')
    expect(s.map((x) => x.char).join('')).toBe('25,431')
    expect(s.filter((x) => x.from !== null).map((x) => `${x.from}->${x.char}@${x.delay}`)).toEqual(['1->3@45', '8->1@0'])
  })
  it('aligns from the right when the number grows a digit', () => {
    const s = rollSlots('9,999', '10,000')
    expect(s.filter((x) => x.from !== null).map((x) => `${x.from}->${x.char}`)).toEqual(['->1', '9->0', '9->0', '9->0', '9->0'])
    expect(s[2]).toEqual({ char: ',', from: null, delay: 0 })
  })
  it('nothing rolls when nothing changed', () => {
    expect(rollSlots('1,234', '1,234').every((x) => x.from === null)).toBe(true)
  })
})
