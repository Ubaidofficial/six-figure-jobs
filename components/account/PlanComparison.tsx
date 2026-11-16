// The comparison on /pricing: what Pro includes (only features that exist) and what rivals charge (read from their pages,
// dated). The live numbers moved to the hero (SiteStatsStrip, the same as the homepage). Server component.
import { COMPETITOR_PRICES, COMPETITOR_PRICES_CHECKED_ON } from '@/lib/billing/competitorPrices'
import type { PlanData } from '@/lib/billing/plans'
import { FREE_MAX_ALERTS_PER_EMAIL, PRO_MAX_ALERTS_PER_EMAIL } from '@/lib/alerts/config'

import styles from './account.module.css'

const n = (value: number) => value.toLocaleString('en-US')

/** "$4.99" for a plan, with the discounted price first when a launch discount applies. */
function OurPrice({ plan }: { plan: PlanData | undefined }) {
  if (!plan?.priceText) return <>Not available</>
  const saving = plan.savingsPercent ? <span className={styles.cellNote}>Save {plan.savingsPercent}% compared with paying weekly</span> : null
  if (!plan.discount?.discountedText) {
    return (
      <>
        <strong>{plan.priceText}</strong>
        {saving}
      </>
    )
  }
  return (
    <>
      <s className={styles.struck}>{plan.priceText}</s> <strong>{plan.discount.discountedText}</strong>
      <span className={styles.cellNote}>
        {plan.discount.percentOff}% off {plan.discount.duration}
      </span>
      {saving}
    </>
  )
}

export function PlanComparison({
  plans,
  instantAlerts,
}: {
  plans: PlanData[]
  /** Whether instant alerts are switched on (ALERTS_ENABLED); the row is left out otherwise. */
  instantAlerts: boolean
}) {
  const weekly = plans.find((p) => p.key === 'subscription_weekly')
  const monthly = plans.find((p) => p.key === 'subscription')

  return (
    <>
      <section className={styles.card} aria-labelledby="included-heading">
        <h2 id="included-heading" className={styles.cardTitle}>
          Free and Pro
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">What you get</th>
                <th scope="col">Free</th>
                <th scope="col">Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Every job, its salary and the employer&apos;s apply link</th>
                <td>Yes</td>
                <td>Yes</td>
              </tr>
              <tr>
                <th scope="row">Daily or weekly email alerts</th>
                <td>Yes</td>
                <td>Yes</td>
              </tr>
              <tr>
                <th scope="row">Saved searches (email alerts)</th>
                <td>{FREE_MAX_ALERTS_PER_EMAIL}</td>
                <td>Up to {PRO_MAX_ALERTS_PER_EMAIL}</td>
              </tr>
              {instantAlerts ? (
                <tr>
                  <th scope="row">Instant alerts, within about 15 minutes of a job appearing</th>
                  <td>No</td>
                  <td>Yes</td>
                </tr>
              ) : null}
              <tr>
                <th scope="row">Credits for the application kit (cover letter per job)</th>
                <td>No</td>
                <td>
                  {weekly ? `${n(weekly.credits)} a week` : null}
                  {weekly && monthly ? ' or ' : null}
                  {monthly ? `${n(monthly.credits)} a month` : null}
                  {!weekly && !monthly ? 'Yes' : null}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="price-heading">
        <h2 id="price-heading" className={styles.cardTitle}>
          How the price compares
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Weekly</th>
                <th scope="col">Monthly</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className={styles.ourRow}>
                <th scope="row">Six Figure Jobs Pro</th>
                <td>
                  <OurPrice plan={weekly} />
                </td>
                <td>
                  <OurPrice plan={monthly} />
                </td>
                <td>Cancel any time</td>
              </tr>
              {COMPETITOR_PRICES.map((c) => (
                <tr key={c.name}>
                  <th scope="row">
                    <a href={c.source} rel="nofollow noopener noreferrer" target="_blank">
                      {c.name}
                    </a>
                  </th>
                  <td>{c.weekly ?? 'No weekly plan listed'}</td>
                  <td>{c.monthly ?? 'Not listed'}</td>
                  <td>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.muted}>
          Other sites&apos; prices were read from their own pricing pages on {COMPETITOR_PRICES_CHECKED_ON} and may have changed;
          check each site before you decide. What each plan includes differs between sites.
        </p>
      </section>
    </>
  )
}
