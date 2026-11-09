'use client'

// The salary-band bars in the hero panel, made selectable. Pick a band and the panel shows how many roles pay in it and
// up to three real, recently added ones. Every band's roles and its "see all" link are in the server HTML (the
// unselected panels are `hidden`, not left out), so the links to those jobs stay crawlable, and the numbers are the same
// ones the bars showed before. Counts use 'en-US' so the server and the browser print them alike.

import * as React from 'react'
import Link from 'next/link'

import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils'
import type { FeedItem } from '@/lib/jobs/latestFeed'

import styles from './Hero.module.css'

export type HeroBand = { label: string; count: number; href: string; samples: FeedItem[] }

export function HeroSalaryBands({ bands }: { bands: HeroBand[] }) {
  const max = Math.max(...bands.map((band) => band.count), 1)
  // Start on the band with the most roles; the same props give the same index on the server and in the browser.
  const [active, setActive] = React.useState(() => bands.reduce((best, band, i) => (band.count > bands[best].count ? i : best), 0))
  const selected = bands[active]
  if (!selected) return null

  return (
    <>
      <ul className={styles.bars} aria-label="Listings by salary band">
        {bands.map((band, i) => (
          <li key={band.label}>
            <button
              type="button"
              className={cn(styles.barRow, i === active && styles.barRowActive)}
              aria-pressed={i === active}
              aria-controls={`hero-band-${i}`}
              onClick={() => setActive(i)}
            >
              <span className={styles.barLabel}>{band.label}</span>
              <span className={styles.barTrack} aria-hidden="true">
                <span className={styles.barFill} style={{ width: `${Math.max(4, (band.count / max) * 100)}%` }} />
              </span>
              <span className={styles.barCount}>{band.count.toLocaleString('en-US')}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className={styles.bandHeadline} aria-live="polite">
        <AnimatedNumber text={selected.count.toLocaleString('en-US')} /> roles pay {selected.label}
      </p>

      {bands.map((band, i) => (
        <div key={band.label} id={`hero-band-${i}`} hidden={i !== active} className={styles.bandPanel}>
          {band.samples.length > 0 ? (
            <ul className={styles.bandJobs}>
              {band.samples.map((job) => (
                <li key={job.id}>
                  <Link href={job.href} prefetch={false} className={styles.bandJob}>
                    <span className={styles.bandJobTitle}>{job.title}</span>
                    <span className={styles.bandJobMeta}>
                      {job.company}
                      {job.salary ? ` · ${job.salary}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <Link href={band.href} className={styles.panelLink}>
            See all {band.label} roles <span aria-hidden="true">→</span>
          </Link>
        </div>
      ))}
    </>
  )
}
