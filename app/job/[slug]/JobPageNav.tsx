'use client'

import * as React from 'react'

import styles from './JobDetail.module.css'

export type JobPageNavItem = { id: string; label: string }

/**
 * A sticky "On this page" bar for the long job page: plain in-page anchors, with the section being read marked
 * (aria-current="location") as the page scrolls. Without IntersectionObserver the links still work, only the marker
 * stays on the first section. The items are decided on the server from the sections the page really renders.
 */
export function JobPageNav({ items }: { items: JobPageNavItem[] }) {
  const [active, setActive] = React.useState(items[0]?.id)

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const sections = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => Boolean(el))
    const inBand = new Set<string>()
    // The band sits just under the sticky bars: a section counts as being read while any part of it is inside it.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id)
          else inBand.delete(entry.target.id)
        }
        const first = items.find((i) => inBand.has(i.id))
        if (first) setActive(first.id)
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 },
    )
    sections.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [items])

  return (
    <nav aria-label="On this page" className={styles.pageNav}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
