import { cn } from '@/lib/utils'
import { hasFlag, normalizeCountryCode } from '@/lib/location/country'

/**
 * A small flag image for a country code. Decorative: always put the country's name in text next to it, the flag is
 * hidden from screen readers and never carries the meaning alone. Renders nothing for a code we have no flag for.
 * Images (public/flags), not emoji: Windows shows flag emoji as two letters.
 */
export function CountryFlag({ code, className }: { code?: string | null; className?: string }) {
  // The EU flag (public/flags/eu.svg) is for the "Europe" market and region; EU is not a country code in job data.
  const cc = typeof code === 'string' && code.trim().toUpperCase() === 'EU' ? 'EU' : normalizeCountryCode(code)
  if (!cc || (cc !== 'EU' && !hasFlag(cc))) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 1 KB SVGs; next/image would only add a proxy hop
    <img
      src={`/flags/${cc.toLowerCase()}.svg`}
      alt=""
      aria-hidden="true"
      width={18}
      height={12}
      decoding="async"
      className={cn(
        'inline-block aspect-[3/2] h-[0.85em] w-auto shrink-0 rounded-[2px] align-[-0.08em] shadow-[0_0_0_1px_rgba(0,0,0,0.14)]',
        className,
      )}
    />
  )
}
