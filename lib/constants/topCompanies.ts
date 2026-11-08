// lib/constants/topCompanies.ts
// Well-known employers shown first in the homepage logo wall ("Top Companies Hiring Now"). A saved, hand-picked list
// (not recomputed daily): every slug is a company with a page on 6figjobs (from /companies, checked 2026-11-08).
// The homepage shows one only while it has live $100k+ jobs, so a stale entry simply drops out. Order = display order.
// Review occasionally and add big names as their jobs arrive.
export const TOP_COMPANY_SLUGS = [
  'google',
  'microsoft',
  'openai',
  'anthropic',
  'linkedin',
  'spacex',
  'ford',
  'servicenow',
  'snowflake',
  'databricks',
  'coinbase',
  'figma',
  'waymo',
  'okta',
  'twilio',
  'pinterest',
  'robinhood',
  'roblox',
  'datadog',
  'mongodb',
  'plaid',
  'stubhub',
  'qualtrics',
  'zscaler',
  'pure-storage',
  'epic-games',
  'hasbro',
  'sharkninja',
  'anduril-industries',
  'samsara',
] as const
