'use client'

import * as React from 'react'
import NextLink from 'next/link'

type Props = React.ComponentProps<typeof NextLink>

/**
 * The site's Link (use it instead of `next/link`). Next's default prefetches every link that scrolls into view; on these
 * pages that meant 15-30 full server renders per page view (listing pages read their search params, so each prefetch
 * re-renders the page), most sent twice, and the click fetched the page again anyway. This one prefetches nothing until
 * the visitor shows intent (pointer over it, keyboard focus, touch), then prefetches the full page, search-param data
 * included, so the click can use it. An explicit `prefetch` prop is respected.
 */
export default function Link({ prefetch, onMouseEnter, onFocus, onTouchStart, ...rest }: Props) {
  const [intent, setIntent] = React.useState(false)
  if (prefetch !== undefined) {
    return <NextLink prefetch={prefetch} onMouseEnter={onMouseEnter} onFocus={onFocus} onTouchStart={onTouchStart} {...rest} />
  }
  return (
    <NextLink
      {...rest}
      prefetch={intent ? true : false}
      onMouseEnter={(e) => {
        setIntent(true)
        onMouseEnter?.(e)
      }}
      onFocus={(e) => {
        setIntent(true)
        onFocus?.(e)
      }}
      onTouchStart={(e) => {
        setIntent(true)
        onTouchStart?.(e)
      }}
    />
  )
}
