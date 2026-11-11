import { orderBySyncAge } from '@/lib/companies/directEmployerSchedule'

describe('orderBySyncAge', () => {
  it('puts never-synced employers first, then the least recently synced, keeping list order for ties', () => {
    const employers = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }, { slug: 'd' }, { slug: 'e' }]
    const lastSynced = new Map<string, Date | null>([
      ['a', new Date('2026-11-11T14:00:00Z')],
      ['b', null],
      ['c', new Date('2026-11-10T14:00:00Z')],
      ['e', new Date('2026-11-10T14:00:00Z')],
    ])
    expect(orderBySyncAge(employers, lastSynced).map((e) => e.slug)).toEqual(['b', 'd', 'c', 'e', 'a'])
  })
})
