'use client'

import * as React from 'react'

/**
 * Wrapper for the phone Apply bar. The hero already has an Apply button, so the bar stays hidden until that card
 * has scrolled out of view (then it slides in). Without IntersectionObserver, or if the hero card cannot be found,
 * the bar is simply always visible.
 */
export function MobileBarShell({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    const target = document.getElementById('job-pay-card')
    if (!target || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0 })
    io.observe(target)
    return () => io.disconnect()
  }, [])

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur transition-transform duration-200 lg:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {children}
    </div>
  )
}
