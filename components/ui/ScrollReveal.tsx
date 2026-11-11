'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

/**
 * Scroll-triggered reveal (workflows.io reference, docs/DESIGN_UX_SPEC.md §11 and §13). Mounted once in the root layout.
 *
 * Mark an element with `data-reveal` in server code. The server HTML is never hidden: this script only hides elements
 * that are still below the viewport once it runs, and shows each one (a short fade + lift) when it scrolls in. Content
 * already on screen, crawlers that render with a tall viewport, users without JS and `prefers-reduced-motion` all get
 * the plain page. `data-reveal-stagger` reveals the element's children one after another (e.g. job rows, heading words);
 * `data-reveal-each` on a list makes each child its own reveal target.
 */
const STAGGER_CAP = 10

function prepare(el: HTMLElement, viewportBottom: number, observer: IntersectionObserver) {
  if (el.getBoundingClientRect().top < viewportBottom) {
    el.dataset.reveal = 'in'
    return
  }
  if (el.hasAttribute('data-reveal-stagger')) {
    Array.from(el.children).forEach((child, i) => {
      ;(child as HTMLElement).style.setProperty('--reveal-i', String(Math.min(i, STAGGER_CAP)))
    })
  }
  el.dataset.reveal = 'pending'
  observer.observe(el)
}

export function ScrollReveal() {
  const pathname = usePathname()

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.reveal = 'in'
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    )

    let frame = 0
    const scan = () => {
      frame = 0
      const bottom = window.innerHeight
      // Lists that reveal each child on its own (long lists, rows appended by infinite scroll).
      document.querySelectorAll<HTMLElement>('[data-reveal-each] > :not([data-reveal])').forEach((el) => {
        el.dataset.reveal = ''
      })
      // "pending" too: an element kept across a client-side navigation (layout) must be observed by the new observer.
      document
        .querySelectorAll<HTMLElement>('[data-reveal=""], [data-reveal="pending"]')
        .forEach((el) => prepare(el, bottom, observer))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scan)
    }

    schedule()
    // Streamed or client-rendered sections that arrive later.
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.body, { childList: true, subtree: true })

    return () => {
      if (frame) cancelAnimationFrame(frame)
      mutations.disconnect()
      observer.disconnect()
    }
  }, [pathname])

  return null
}
