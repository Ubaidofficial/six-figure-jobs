export type JobCategoryConfig = {
  label: string
  roleSlugs: string[]
}

export const JOB_CATEGORY_MAP: Record<string, JobCategoryConfig> = {
  engineering: {
    label: 'Engineering',
    roleSlugs: [
      'software-engineer',
      'backend-engineer',
      'frontend-engineer',
      'full-stack-engineer',
      'mobile-engineer',
      'ios-engineer',
      'android-engineer',
      'platform-engineer',
      'systems-engineer',
      'application-engineer',
      'devops-engineer',
      'site-reliability-engineer',
      'infrastructure-engineer',
      'web-developer',
    ],
  },
  product: {
    label: 'Product',
    roleSlugs: ['product-manager', 'technical-product-manager', 'product-owner'],
  },
  data: {
    label: 'Data',
    roleSlugs: ['data-scientist', 'data-engineer', 'data-analyst', 'analytics-engineer'],
  },
  design: {
    label: 'Design',
    roleSlugs: ['product-designer', 'ux-designer', 'ui-designer', 'designer'],
  },
  devops: {
    label: 'DevOps',
    roleSlugs: ['devops-engineer', 'site-reliability-engineer', 'infrastructure-engineer'],
  },
  mlai: {
    label: 'ML / AI',
    roleSlugs: ['machine-learning-engineer', 'ai-engineer', 'ml-engineer', 'data-scientist'],
  },
  sales: {
    label: 'Sales',
    roleSlugs: ['sales', 'account-executive', 'sales-engineer', 'sdr', 'bdr'],
  },
  marketing: {
    label: 'Marketing',
    roleSlugs: ['marketing', 'growth-marketer', 'demand-generation', 'seo', 'performance-marketing'],
  },
}

export const JOB_CATEGORY_SLUGS = Object.keys(JOB_CATEGORY_MAP)

export function normalizeCategorySlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function resolveJobCategory(slug: string): JobCategoryConfig | undefined {
  return JOB_CATEGORY_MAP[normalizeCategorySlug(slug)]
}
