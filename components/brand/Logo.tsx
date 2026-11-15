// components/brand/Logo.tsx
//
// The logo as inline vector (artwork in logoArt.ts, drawn from Outfit ExtraBold outlines): "stacked-tag" is the full
// lockup with the "$100,000+" tag (website), "stacked" the same without the tag (small spaces, favicon source) and
// "wide" the one-line version that fits the header bar. Letters take the surrounding text colour; size it with CSS
// height (width follows the artwork's proportions).

import { LOGO_ART, type LogoVariant } from './logoArt'

export function Logo({ variant, className }: { variant: LogoVariant; className?: string }) {
  const art = LOGO_ART[variant]
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={art.viewBox}
      role="img"
      aria-label="Six Figure Jobs"
      className={className}
      // Static artwork generated into logoArt.ts; no user input reaches it.
      dangerouslySetInnerHTML={{ __html: art.inner }}
    />
  )
}
