// components/sponsors/SponsorStrip.tsx
// The sponsored placements, one short card each under a "Sponsored" label. Nothing at all when no slot is active.
// The link is marked rel="sponsored" (Google's name for a paid link). Not a job: no JobPosting markup, no ranking.
import { CompanyLogo } from '@/components/companies/CompanyLogo'
import type { SponsorSlot } from '@/lib/sponsors/slots'

import styles from './SponsorStrip.module.css'

export function SponsorStrip({ slots }: { slots: SponsorSlot[] }) {
  if (slots.length === 0) return null
  return (
    <aside className={styles.strip} aria-label="Sponsored">
      <p className={styles.label}>Sponsored</p>
      <ul className={styles.list}>
        {slots.map((slot) => (
          <li key={slot.id}>
            <a href={slot.href} target="_blank" rel="sponsored noopener" className={styles.card}>
              {/* A white tile, so a logo drawn for a light page is not lost on a dark card. */}
              <span className={styles.logo}>
                <CompanyLogo name={slot.name} src={slot.logo} size="md" />
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{slot.name}</span>
                {slot.text ? <span className={styles.blurb}>{slot.text}</span> : null}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
