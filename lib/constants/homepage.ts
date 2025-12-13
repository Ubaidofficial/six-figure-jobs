// lib/constants/homepage.ts
export const LOCATIONS = [
  { code: 'united-states', label: 'United States', flag: '🇺🇸' },
  { code: 'united-kingdom', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'canada', label: 'Canada', flag: '🇨🇦' },
  { code: 'germany', label: 'Germany', flag: '🇩🇪' },
  { code: 'ireland', label: 'Ireland', flag: '🇮🇪' },
  { code: 'switzerland', label: 'Switzerland', flag: '🇨🇭' },
  { code: 'singapore', label: 'Singapore', flag: '🇸🇬' },
  { code: 'australia', label: 'Australia', flag: '🇦🇺' },
  { code: 'new-zealand', label: 'New Zealand', flag: '🇳🇿' },
  { code: 'remote', label: 'Remote Only', flag: '🌍' },
] as const

export const SALARY_BANDS = [
  {
    min: 100_000,
    label: '$100k+',
    slug: '100k-plus',
    description: 'Six figure jobs',
  },
  {
    min: 200_000,
    label: '$200k+',
    slug: '200k-plus',
    description: 'High six figure jobs',
  },
  {
    min: 300_000,
    label: '$300k+',
    slug: '300k-plus',
    description: 'Premium positions',
  },
  {
    min: 400_000,
    label: '$400k+',
    slug: '400k-plus',
    description: 'Executive compensation',
  },
] as const
