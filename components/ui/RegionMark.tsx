import { CountryFlag } from '@/components/ui/CountryFlag'

/**
 * A flag (two-letter code, including EU) or an emoji before a country or region name. Decorative, like CountryFlag:
 * the name is always in text next to it.
 */
export function RegionMark({ mark, className }: { mark?: string | null; className?: string }) {
  if (!mark) return null
  if (/^[A-Za-z]{2}$/.test(mark)) return <CountryFlag code={mark} className={className} />
  return (
    <span aria-hidden="true" className={className}>
      {mark}
    </span>
  )
}
