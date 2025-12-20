export type SalaryTierId = '100k-plus' | '200k-plus' | '300k-plus' | '400k-plus'

export type SalaryTierConfig = {
  id: SalaryTierId
  emoji: string
  title: string
  rangeLabel: string
  minAnnualUsd: number
  maxAnnualUsd: number | null
  theme: {
    accentA: string
    accentB: string
    goldA?: string
    goldB?: string
  }
}

export const SALARY_TIERS: Record<SalaryTierId, SalaryTierConfig> = {
  '100k-plus': {
    id: '100k-plus',
    emoji: '💰',
    title: '$100k - $199k Jobs',
    rangeLabel: '$100k–$199k',
    minAnnualUsd: 100_000,
    maxAnnualUsd: 199_999,
    theme: {
      accentA: '#84CC16',
      accentB: '#65A30D',
    },
  },
  '200k-plus': {
    id: '200k-plus',
    emoji: '💎',
    title: '$200k - $299k Jobs',
    rangeLabel: '$200k–$299k',
    minAnnualUsd: 200_000,
    maxAnnualUsd: 299_999,
    theme: {
      accentA: '#84CC16',
      accentB: '#65A30D',
      goldA: '#FDE68A',
      goldB: '#F59E0B',
    },
  },
  '300k-plus': {
    id: '300k-plus',
    emoji: '🏆',
    title: '$300k - $399k Jobs',
    rangeLabel: '$300k–$399k',
    minAnnualUsd: 300_000,
    maxAnnualUsd: 399_999,
    theme: {
      accentA: '#F59E0B',
      accentB: '#84CC16',
      goldA: '#FBBF24',
      goldB: '#84CC16',
    },
  },
  '400k-plus': {
    id: '400k-plus',
    emoji: '👑',
    title: '$400k+ Elite Jobs',
    rangeLabel: '$400k+',
    minAnnualUsd: 400_000,
    maxAnnualUsd: null,
    theme: {
      accentA: '#FDE68A',
      accentB: '#F59E0B',
      goldA: '#FDE68A',
      goldB: '#F59E0B',
    },
  },
}

