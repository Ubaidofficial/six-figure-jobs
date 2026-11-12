'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

/**
 * Page transition on client-side navigations: the content area fades and lifts in (260 ms) after each route change.
 * Never on the first load, so the server HTML, its largest paint and crawlers are untouched; off under reduced motion
 * (the CSS). Runs in a layout effect, i.e. in the same commit as the new page and before it paints, so nothing flickers.
 */
export function RouteTransition() {
  const pathname = usePathname()
  const first = React.useRef(true)

  React.useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const el = document.getElementById('main-content')
    if (!el) return
    el.classList.remove('route-enter')
    void el.offsetWidth // restart the animation when navigating again before it ended
    el.classList.add('route-enter')
  }, [pathname])

  return null
}
