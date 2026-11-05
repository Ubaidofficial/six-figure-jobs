// components/listing/SalaryByLevel.tsx
// "Salary by experience level" table for a role page: median pay and listing count per level, each level linking to
// its own page. An async server component that renders nothing when fewer than two levels have enough listings, so a
// page never shows a comparison it cannot back up.

import Link from 'next/link'

import { loadSalaryByLevel } from '@/lib/jobs/listingSalaryStats'
import type { JobQueryInput } from '@/lib/jobs/queryJobs'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

import { ListingSection } from './ListingParts'
import styles from './Listing.module.css'

const LEVEL_LABEL: Record<string, string> = {
  entry: 'Entry level',
  mid: 'Mid level',
  senior: 'Senior',
  lead: 'Lead / Staff',
  executive: 'Executive',
}

export async function SalaryByLevel({ input, label }: { input: JobQueryInput; label: string }) {
  let data: Awaited<ReturnType<typeof loadSalaryByLevel>> = null
  try {
    data = await loadSalaryByLevel(input)
  } catch {
    return null
  }
  if (!data) return null
  const { levels, currency } = data

  return (
    <ListingSection title={`${label} salary by experience level`}>
      <table className={styles.levelTable}>
        <caption className={styles.levelCaption}>
          Median {label} pay in {currency} by level, from the listings on this site that publish a salary. Each listing
          counts once at the middle of its range; the level is read from the job title.
        </caption>
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Median</th>
            <th scope="col">Listings</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((l) => (
            <tr key={l.level}>
              <th scope="row">
                <Link href={`/jobs/level/${l.level}`}>{LEVEL_LABEL[l.level] ?? l.level}</Link>
              </th>
              <td>{formatCurrencyShort(Math.round(l.median / 1000) * 1000, currency)}</td>
              <td>{l.count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ListingSection>
  )
}
