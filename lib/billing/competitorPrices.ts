// lib/billing/competitorPrices.ts
//
// What other job boards charge job seekers, for the comparison on /pricing. These are NOT live: each row was read from the
// site's own public pricing page on CHECKED_ON and goes stale. Re-read the pages before changing a figure or the date, and
// remove a row rather than keep a price that cannot be verified. Every figure is the headline price in USD.
// Not listed because the price could not be read from the site itself: Remotive ("Unlock All Jobs"), FlexJobs.

export const COMPETITOR_PRICES_CHECKED_ON = '2026-11-15'

export interface CompetitorPrice {
  name: string
  /** The page the figures were read from. */
  source: string
  weekly: string | null
  monthly: string | null
  /** One line of what the price comes with, as that page states it. */
  note: string
}

export const COMPETITOR_PRICES: CompetitorPrice[] = [
  {
    name: '4dayweek.io Pro',
    source: 'https://4dayweek.io/pro',
    weekly: '$9',
    monthly: '$25',
    note: 'Also $49 every 3 months. 14-day money-back.',
  },
  {
    name: 'Remote Rocketship',
    source: 'https://www.remoterocketship.com/pricing/',
    weekly: null,
    monthly: '$29',
    note: 'Also $59 every 3 months, $99 a year. 14-day money-back.',
  },
  {
    name: 'Remote OK Premium',
    source: 'https://remoteok.com/premium',
    weekly: null,
    monthly: '$14.95',
    note: '12-month commitment, billed monthly. No free trial.',
  },
]
