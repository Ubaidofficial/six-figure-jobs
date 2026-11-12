'use client'

import * as React from 'react'

import styles from './SectionIndicator.module.css'

/**
 * A small pill under the header naming the homepage section being read ("Latest jobs", "Salary", ...), from the
 * sections' own pill labels (.section-eyebrow), with a thin line for how far down the page you are. Hidden over the
 * hero. Decorative (aria-hidden): it only repeats labels that are already on the page.
 */
export function SectionIndicator() {
  const [label, setLabel] = React.useState<string | null>(null)
  const barRef = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const line = window.innerHeight * 0.35
      let current: string | null = null
      for (const el of document.querySelectorAll<HTMLElement>('#main-content .section-eyebrow')) {
        if (el.getBoundingClientRect().top < line) current = el.textContent?.trim() || null
        else break
      }
      setLabel(current)
      const max = document.documentElement.scrollHeight - window.innerHeight
      barRef.current?.style.setProperty('--progress', String(max > 0 ? Math.min(1, window.scrollY / max) : 0))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <div className={label ? `${styles.pill} ${styles.visible}` : styles.pill} aria-hidden="true">
      <span className={styles.dot} />
      <span key={label ?? ''} className={styles.label}>
        {label ?? ''}
      </span>
      <span className={styles.track}>
        <span ref={barRef} className={styles.bar} />
      </span>
    </div>
  )
}
