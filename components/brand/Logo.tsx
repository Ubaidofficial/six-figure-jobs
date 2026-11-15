// components/brand/Logo.tsx
//
// The logo as a real image (an <img> of the vector file in public/brand/), so a visitor can right-click it and
// "Save image as". "stacked-tag" is the full lockup with the "$100,000+" tag (website), "stacked" the same without the
// tag (small spaces, favicon source) and "wide" the one-line version that fits the header bar. The site is light-only,
// so the light files (ink letters) are used; the *-dark.svg files are for dark backgrounds elsewhere. Size it with CSS
// height (width follows the artwork's proportions). Artwork and its measurements: logoArt.ts.

import { LOGO_ART, type LogoVariant } from './logoArt'

export function Logo({ variant, className }: { variant: LogoVariant; className?: string }) {
  const art = LOGO_ART[variant]
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG: nothing to optimise, and it must stay a plain image file
    <img
      src={`/brand/logo-${variant}-light.svg`}
      alt="Six Figure Jobs"
      width={art.width}
      height={art.height}
      decoding="async"
      className={className}
    />
  )
}
