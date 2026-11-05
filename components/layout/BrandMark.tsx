// components/layout/BrandMark.tsx
// The "6+" mark without a tile: the 6 takes the surrounding text colour, the plus takes the brand accent, so it
// reads in both themes. The 6 is the outline of the digit in Bricolage Grotesque ExtraBold (the site's headline
// face); the tile version used for the favicon and app icon is app/icon.svg.

const SIX =
  'M317 -14Q175 -14 101.0 73.5Q27 161 27 324Q27 440 63.0 517.5Q99 595 163.5 634.5Q228 674 313 674Q359 674 401.0 662.0Q443 650 475.0 624.5Q507 599 524.5 558.5Q542 518 539 461L388 445Q388 483 374.0 503.5Q360 524 340.5 532.0Q321 540 303 540Q275 540 253.0 525.0Q231 510 216.5 483.0Q202 456 194.5 419.5Q187 383 187 341Q187 316 190.0 288.0Q193 260 197 233H201Q199 289 214.5 324.0Q230 359 255.5 378.5Q281 398 310.0 405.0Q339 412 364 412Q419 412 464.5 389.5Q510 367 538.0 322.0Q566 277 566 211Q566 172 553.5 132.0Q541 92 512.5 59.0Q484 26 436.0 6.0Q388 -14 317 -14ZM312 115Q333 115 349.5 121.5Q366 128 378.5 140.5Q391 153 397.5 170.0Q404 187 404 207Q404 236 393.0 256.5Q382 277 362.0 288.0Q342 299 315 299Q287 299 266.0 287.0Q245 275 233.0 253.5Q221 232 221 202Q221 182 227.5 166.0Q234 150 245.5 138.5Q257 127 274.0 121.0Q291 115 312 115Z'

type BrandMarkProps = { className?: string }

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="4 6 56 51"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <path transform="translate(4.312 54.125) scale(0.0625 -0.0625)" d={SIX} fill="currentColor" />
      <path
        d="M44 16H56M50 10V22"
        stroke="var(--color-primary-text)"
        strokeWidth="4.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
