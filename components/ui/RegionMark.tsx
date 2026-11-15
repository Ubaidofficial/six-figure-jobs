import { Globe } from 'lucide-react'

import { CountryFlag } from '@/components/ui/CountryFlag'

/**
 * A flag (two-letter code, including EU), the "globe" icon or an emoji before a country or region name. Decorative, like CountryFlag:
 * the name is always in text next to it.
 */
export function RegionMark({ mark, className }: { mark?: string | null; className?: string }) {
  if (!mark) return null
  if (/^[A-Za-z]{2}$/.test(mark)) return <CountryFlag code={mark} className={className} />
  // "globe" is the worldwide mark: one line icon instead of a 🌍/🌎 emoji, whose drawing differs by device.
  if (mark === 'globe') return <Globe aria-hidden="true" className={`inline-block size-[1em] align-[-0.12em] ${className ?? ''}`} />
  return (
    <span aria-hidden="true" className={className}>
      {mark}
    </span>
  )
}
