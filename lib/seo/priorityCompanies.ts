export const PRIORITY_COMPANY_SLUGS = [
  'amazon',
  'microsoft',
  'google',
  'meta',
  'apple',
  'netflix',
  'nvidia',
  'salesforce',
  'stripe',
  'openai',
  'anthropic',
  'mongodb',
  'datadog',
  'figma',
  'vercel',
  'airbnb',
  'shopify',
  'brex',
  'scale-ai',
  'spacex',
] as const

const PRIORITY_COMPANY_RANK = new Map<string, number>(
  PRIORITY_COMPANY_SLUGS.map((slug, index) => [slug, index + 1] as const),
)

export function getPriorityCompanyRank(slug: string | null | undefined): number | null {
  if (!slug) return null
  return PRIORITY_COMPANY_RANK.get(slug) ?? null
}

export function isPriorityCompanySlug(slug: string | null | undefined): boolean {
  return getPriorityCompanyRank(slug) !== null
}
