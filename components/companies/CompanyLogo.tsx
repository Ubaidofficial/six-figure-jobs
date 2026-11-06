'use client'

// One company logo for the whole site: a server-rendered <img> (so it is in the HTML and paints with the
// page) that falls back to coloured initials if the image is missing or fails to load. This replaces
// five hand-rolled versions, one of which (the job page) had no fallback for a broken image.
//
// shadcn's <Avatar> only renders its image after hydration, which would flash initials on every
// logo above the fold, so the image is a plain <img> and Avatar is not used here.
import * as React from 'react'

import { cn } from '@/lib/utils'
import { fallbackHue, getInitials, needsDarkTile } from '@/lib/companies/logoFallback'

const SIZES = {
  fill: 'size-full', // fills a wrapper that is already sized by its own CSS
  sm: 'size-8 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-[72px] text-xl',
} as const

export type CompanyLogoSize = keyof typeof SIZES

export function CompanyLogo({
  name,
  src,
  size = 'md',
  priority = false,
  className,
}: {
  name: string
  src?: string | null
  size?: CompanyLogoSize
  /** Set for a logo in the first screen so the browser fetches it eagerly. */
  priority?: boolean
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)

  React.useEffect(() => {
    setFailed(false)
  }, [src])

  // An image that failed before hydration never fires onError; catch it here.
  React.useEffect(() => {
    const el = imgRef.current
    if (el && el.complete && el.naturalWidth === 0) setFailed(true)
  }, [src])

  const showImage = Boolean(src) && !failed
  const hue = fallbackHue(name)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden',
        size !== 'fill' && 'rounded-lg border border-border',
        showImage ? (needsDarkTile(name) ? 'bg-slate-800' : 'bg-white') : '',
        SIZES[size],
        className,
      )}
      style={showImage ? undefined : { backgroundColor: `hsl(${hue} 32% 20%)`, color: `hsl(${hue} 70% 82%)` }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo hosts are unoptimised third-party CDNs
        <img
          ref={imgRef}
          src={src!}
          alt={`${name} logo`}
          width={72}
          height={72}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-contain p-1"
        />
      ) : (
        <span aria-hidden="true" className="font-semibold leading-none tracking-tight">
          {getInitials(name)}
        </span>
      )}
    </span>
  )
}
