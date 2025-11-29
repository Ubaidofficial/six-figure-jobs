// lib/roles/salaryRoles.ts
// Canonical list of high-intent tech + SaaS roles for salary pages.

/**
 * Each entry in EXPANDED_SALARY_ROLES can become a /salary/[slug] page.
 * We generate variants like:
 *  - senior-{slug}
 *  - staff-{slug}
 *  - principal-{slug}
 *  - lead-{slug}
 *  - head-of-{slug}
 * giving you 600+ salary pages from a compact base list.
 */

export type SalaryRole = {
  slug: string
  label: string
  category:
    | 'engineering'
    | 'data'
    | 'ml_ai'
    | 'infrastructure'
    | 'security'
    | 'product'
    | 'design'
    | 'marketing'
    | 'sales'
    | 'revops'
    | 'customer'
    | 'gtm'
    | 'management'
    | 'devtools'
    | 'program'
    | 'analytics'
    | 'finance'
    | 'other'
}

/* -------------------------------------------------------------------------- */
/* Base roles                                                                 */
/* -------------------------------------------------------------------------- */

export const BASE_SALARY_ROLES: SalaryRole[] = [
  /* -------------------------- Core engineering -------------------------- */
  {
    slug: 'software-engineer',
    label: 'Software Engineer',
    category: 'engineering',
  },
  {
    slug: 'backend-engineer',
    label: 'Backend Engineer',
    category: 'engineering',
  },
  {
    slug: 'frontend-engineer',
    label: 'Frontend Engineer',
    category: 'engineering',
  },
  {
    slug: 'full-stack-engineer',
    label: 'Full Stack Engineer',
    category: 'engineering',
  },
  {
    slug: 'web-developer',
    label: 'Web Developer',
    category: 'engineering',
  },
  {
    slug: 'mobile-developer',
    label: 'Mobile Developer',
    category: 'engineering',
  },
  {
    slug: 'ios-engineer',
    label: 'iOS Engineer',
    category: 'engineering',
  },
  {
    slug: 'android-engineer',
    label: 'Android Engineer',
    category: 'engineering',
  },
  {
    slug: 'platform-engineer',
    label: 'Platform Engineer',
    category: 'engineering',
  },
  {
    slug: 'systems-engineer',
    label: 'Systems Engineer',
    category: 'engineering',
  },
  {
    slug: 'application-engineer',
    label: 'Application Engineer',
    category: 'engineering',
  },
  {
    slug: 'embedded-software-engineer',
    label: 'Embedded Software Engineer',
    category: 'engineering',
  },
  {
    slug: 'firmware-engineer',
    label: 'Firmware Engineer',
    category: 'engineering',
  },
  {
    slug: 'game-engineer',
    label: 'Game Engineer',
    category: 'engineering',
  },

  /* -------------------------- Data / Analytics -------------------------- */
  {
    slug: 'data-scientist',
    label: 'Data Scientist',
    category: 'data',
  },
  {
    slug: 'data-engineer',
    label: 'Data Engineer',
    category: 'data',
  },
  {
    slug: 'analytics-engineer',
    label: 'Analytics Engineer',
    category: 'data',
  },
  {
    slug: 'data-analyst',
    label: 'Data Analyst',
    category: 'data',
  },
  {
    slug: 'business-intelligence-engineer',
    label: 'Business Intelligence Engineer',
    category: 'analytics',
  },
  {
    slug: 'bi-analyst',
    label: 'BI Analyst',
    category: 'analytics',
  },
  {
    slug: 'bi-developer',
    label: 'BI Developer',
    category: 'analytics',
  },
  {
    slug: 'quantitative-developer',
    label: 'Quantitative Developer',
    category: 'analytics',
  },
  {
    slug: 'quantitative-engineer',
    label: 'Quantitative Engineer',
    category: 'analytics',
  },

  /* ---------------------------- ML / AI roles --------------------------- */
  {
    slug: 'machine-learning-engineer',
    label: 'Machine Learning Engineer',
    category: 'ml_ai',
  },
  {
    slug: 'ml-research-engineer',
    label: 'ML Research Engineer',
    category: 'ml_ai',
  },
  {
    slug: 'ml-infrastructure-engineer',
    label: 'ML Infrastructure Engineer',
    category: 'ml_ai',
  },
  {
    slug: 'applied-scientist',
    label: 'Applied Scientist',
    category: 'ml_ai',
  },
  {
    slug: 'research-scientist-ml',
    label: 'Research Scientist (ML)',
    category: 'ml_ai',
  },
  {
    slug: 'deep-learning-engineer',
    label: 'Deep Learning Engineer',
    category: 'ml_ai',
  },
  {
    slug: 'nlp-engineer',
    label: 'NLP Engineer',
    category: 'ml_ai',
  },
  {
    slug: 'computer-vision-engineer',
    label: 'Computer Vision Engineer',
    category: 'ml_ai',
  },
  {
    slug: 'ai-engineer',
    label: 'AI Engineer',
    category: 'ml_ai',
  },
  {
    slug: 'generative-ai-engineer',
    label: 'Generative AI Engineer',
    category: 'ml_ai',
  },
  {
    slug: 'llm-engineer',
    label: 'LLM Engineer',
    category: 'ml_ai',
  },
  {
    slug: 'mlops-engineer',
    label: 'MLOps Engineer',
    category: 'ml_ai',
  },

  /* ------------------------ Infra / Cloud / DevOps ---------------------- */
  {
    slug: 'devops-engineer',
    label: 'DevOps Engineer',
    category: 'infrastructure',
  },
  {
    slug: 'site-reliability-engineer',
    label: 'Site Reliability Engineer',
    category: 'infrastructure',
  },
  {
    slug: 'sre-engineer',
    label: 'SRE Engineer',
    category: 'infrastructure',
  },
  {
    slug: 'cloud-engineer',
    label: 'Cloud Engineer',
    category: 'infrastructure',
  },
  {
    slug: 'cloud-architect',
    label: 'Cloud Architect',
    category: 'infrastructure',
  },
  {
    slug: 'infrastructure-engineer',
    label: 'Infrastructure Engineer',
    category: 'infrastructure',
  },
  {
    slug: 'network-engineer',
    label: 'Network Engineer',
    category: 'infrastructure',
  },
  {
    slug: 'kubernetes-engineer',
    label: 'Kubernetes Engineer',
    category: 'infrastructure',
  },
  {
    slug: 'systems-administrator',
    label: 'Systems Administrator',
    category: 'infrastructure',
  },

  /* --------------------------- Security / Privacy ------------------------ */
  {
    slug: 'security-engineer',
    label: 'Security Engineer',
    category: 'security',
  },
  {
    slug: 'application-security-engineer',
    label: 'Application Security Engineer',
    category: 'security',
  },
  {
    slug: 'cloud-security-engineer',
    label: 'Cloud Security Engineer',
    category: 'security',
  },
  {
    slug: 'security-architect',
    label: 'Security Architect',
    category: 'security',
  },
  {
    slug: 'security-analyst',
    label: 'Security Analyst',
    category: 'security',
  },
  {
    slug: 'privacy-engineer',
    label: 'Privacy Engineer',
    category: 'security',
  },

  /* ------------------------------ Product -------------------------------- */
  {
    slug: 'product-manager',
    label: 'Product Manager',
    category: 'product',
  },
  {
    slug: 'technical-product-manager',
    label: 'Technical Product Manager',
    category: 'product',
  },
  {
    slug: 'group-product-manager',
    label: 'Group Product Manager',
    category: 'product',
  },
  {
    slug: 'product-owner',
    label: 'Product Owner',
    category: 'product',
  },
  {
    slug: 'head-of-product',
    label: 'Head of Product',
    category: 'product',
  },
  {
    slug: 'vp-of-product',
    label: 'VP of Product',
    category: 'product',
  },

  /* ----------------------------- Design / UX ----------------------------- */
  {
    slug: 'product-designer',
    label: 'Product Designer',
    category: 'design',
  },
  {
    slug: 'ux-designer',
    label: 'UX Designer',
    category: 'design',
  },
  {
    slug: 'ui-designer',
    label: 'UI Designer',
    category: 'design',
  },
  {
    slug: 'ux-researcher',
    label: 'UX Researcher',
    category: 'design',
  },
  {
    slug: 'interaction-designer',
    label: 'Interaction Designer',
    category: 'design',
  },
  {
    slug: 'design-systems-designer',
    label: 'Design Systems Designer',
    category: 'design',
  },

  /* -------------------------- Eng mgmt / leadership ---------------------- */
  {
    slug: 'engineering-manager',
    label: 'Engineering Manager',
    category: 'management',
  },
  {
    slug: 'director-of-engineering',
    label: 'Director of Engineering',
    category: 'management',
  },
  {
    slug: 'vp-of-engineering',
    label: 'VP of Engineering',
    category: 'management',
  },
  {
    slug: 'cto',
    label: 'CTO',
    category: 'management',
  },
  {
    slug: 'tech-lead',
    label: 'Tech Lead',
    category: 'management',
  },
  {
    slug: 'staff-engineer',
    label: 'Staff Engineer',
    category: 'management',
  },
  {
    slug: 'principal-engineer',
    label: 'Principal Engineer',
    category: 'management',
  },
  {
    slug: 'software-architect',
    label: 'Software Architect',
    category: 'management',
  },
  {
    slug: 'solutions-architect',
    label: 'Solutions Architect',
    category: 'management',
  },

  /* ------------------------- DevTools / platform ------------------------- */
  {
    slug: 'developer-advocate',
    label: 'Developer Advocate',
    category: 'devtools',
  },
  {
    slug: 'developer-relations-engineer',
    label: 'Developer Relations Engineer',
    category: 'devtools',
  },
  {
    slug: 'api-engineer',
    label: 'API Engineer',
    category: 'devtools',
  },
  {
    slug: 'sdk-engineer',
    label: 'SDK Engineer',
    category: 'devtools',
  },
  {
    slug: 'devtools-engineer',
    label: 'DevTools Engineer',
    category: 'devtools',
  },

  /* --------------------------- Program / TPM ----------------------------- */
  {
    slug: 'program-manager',
    label: 'Program Manager',
    category: 'program',
  },
  {
    slug: 'technical-program-manager',
    label: 'Technical Program Manager',
    category: 'program',
  },
  {
    slug: 'delivery-manager',
    label: 'Delivery Manager',
    category: 'program',
  },

  /* -------------------------- GTM / Solutions ---------------------------- */
  {
    slug: 'solutions-engineer',
    label: 'Solutions Engineer',
    category: 'gtm',
  },
  {
    slug: 'sales-engineer',
    label: 'Sales Engineer',
    category: 'gtm',
  },
  {
    slug: 'customer-success-engineer',
    label: 'Customer Success Engineer',
    category: 'gtm',
  },
  {
    slug: 'technical-account-manager',
    label: 'Technical Account Manager',
    category: 'gtm',
  },
  {
    slug: 'growth-engineer',
    label: 'Growth Engineer',
    category: 'gtm',
  },

  /* ---------------------------- Marketing Roles -------------------------- */
  {
    slug: 'growth-marketer',
    label: 'Growth Marketer',
    category: 'marketing',
  },
  {
    slug: 'performance-marketer',
    label: 'Performance Marketer',
    category: 'marketing',
  },
  {
    slug: 'demand-generation-manager',
    label: 'Demand Generation Manager',
    category: 'marketing',
  },
  {
    slug: 'content-marketing-manager',
    label: 'Content Marketing Manager',
    category: 'marketing',
  },
  {
    slug: 'seo-manager',
    label: 'SEO Manager',
    category: 'marketing',
  },
  {
    slug: 'product-marketing-manager',
    label: 'Product Marketing Manager',
    category: 'marketing',
  },
  {
    slug: 'lifecycle-marketing-manager',
    label: 'Lifecycle Marketing Manager',
    category: 'marketing',
  },
  {
    slug: 'marketing-operations-manager',
    label: 'Marketing Operations Manager',
    category: 'marketing',
  },

  /* ---------------------------- Sales Roles ------------------------------ */
  {
    slug: 'account-executive',
    label: 'Account Executive',
    category: 'sales',
  },
  {
    slug: 'enterprise-account-executive',
    label: 'Enterprise Account Executive',
    category: 'sales',
  },
  {
    slug: 'sales-manager',
    label: 'Sales Manager',
    category: 'sales',
  },
  {
    slug: 'vp-of-sales',
    label: 'VP of Sales',
    category: 'sales',
  },
  {
    slug: 'sales-development-representative',
    label: 'Sales Development Representative (SDR)',
    category: 'sales',
  },
  {
    slug: 'business-development-representative',
    label: 'Business Development Representative (BDR)',
    category: 'sales',
  },

  /* ----------------------------- RevOps Roles ---------------------------- */
  {
    slug: 'revenue-operations-manager',
    label: 'Revenue Operations Manager',
    category: 'revops',
  },
  {
    slug: 'sales-operations-manager',
    label: 'Sales Operations Manager',
    category: 'revops',
  },
  {
    slug: 'revops-analyst',
    label: 'RevOps Analyst',
    category: 'revops',
  },

  /* ------------------------- Customer Success Roles ---------------------- */
  {
    slug: 'customer-success-manager',
    label: 'Customer Success Manager',
    category: 'customer',
  },
  {
    slug: 'customer-success-lead',
    label: 'Customer Success Lead',
    category: 'customer',
  },
  {
    slug: 'director-of-customer-success',
    label: 'Director of Customer Success',
    category: 'customer',
  },
  {
    slug: 'customer-support-engineer',
    label: 'Customer Support Engineer',
    category: 'customer',
  },

  /* -------------------------- SaaS GTM Leadership ------------------------ */
  {
    slug: 'head-of-growth',
    label: 'Head of Growth',
    category: 'gtm',
  },
  {
    slug: 'chief-revenue-officer',
    label: 'Chief Revenue Officer (CRO)',
    category: 'gtm',
  },
  {
    slug: 'head-of-sales',
    label: 'Head of Sales',
    category: 'sales',
  },
  {
    slug: 'head-of-marketing',
    label: 'Head of Marketing',
    category: 'marketing',
  },

  /* -------------------------- Finance / Other ---------------------------- */
  {
    slug: 'fintech-engineer',
    label: 'Fintech Engineer',
    category: 'finance',
  },
  {
    slug: 'finance-data-analyst',
    label: 'Finance Data Analyst',
    category: 'finance',
  },
]

/* -------------------------------------------------------------------------- */
/* Expanded roles (with seniority prefixes)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Prefixes that generate extra salary pages.
 * We intentionally skip "junior" etc. for now and focus on high-value variants.
 */
const SENIORITY_PREFIXES = [
  'senior',
  'staff',
  'principal',
  'lead',
  'head-of',
] as const

type SeniorityPrefix = (typeof SENIORITY_PREFIXES)[number]

function prefixLabel(prefix: SeniorityPrefix): string {
  switch (prefix) {
    case 'senior':
      return 'Senior'
    case 'staff':
      return 'Staff'
    case 'principal':
      return 'Principal'
    case 'lead':
      return 'Lead'
    case 'head-of':
      return 'Head of'
    default:
      return ''
  }
}

/**
 * Roles that should be expanded with seniority prefixes.
 * We usually avoid expanding pure "management" and C-level titles.
 */
function shouldExpandRole(role: SalaryRole): boolean {
  if (role.category === 'management') {
    return false
  }

  // Some specific titles already contain seniority; don't double-prefix.
  const lowered = role.slug.toLowerCase()
  if (
    lowered.startsWith('senior-') ||
    lowered.startsWith('staff-') ||
    lowered.startsWith('principal-') ||
    lowered.startsWith('lead-') ||
    lowered.startsWith('head-of-') ||
    lowered.startsWith('vp-') ||
    lowered.startsWith('director-') ||
    lowered.startsWith('chief-') ||
    lowered.startsWith('cto')
  ) {
    return false
  }

  return true
}

/**
 * EXPANDED_SALARY_ROLES:
 *  - includes all base roles
 *  - plus prefixed variants (senior-, staff-, principal-, lead-, head-of-)
 * This gives you 600+ high-intent role slugs from a compact, manageable base set.
 */
export const EXPANDED_SALARY_ROLES: SalaryRole[] = (() => {
  const result: SalaryRole[] = []

  for (const role of BASE_SALARY_ROLES) {
    // Always include the base role itself
    result.push(role)

    // Add seniority variants where appropriate
    if (shouldExpandRole(role)) {
      for (const prefix of SENIORITY_PREFIXES) {
        const labelPrefix = prefixLabel(prefix)

        result.push({
          slug: `${prefix}-${role.slug}`,
          label: `${labelPrefix} ${role.label}`,
          category: role.category,
        })
      }
    }
  }

  return result
})()

/**
 * Default export can be used wherever you want "all salary roles".
 * For sitemaps and static generation, prefer EXPANDED_SALARY_ROLES.
 */
export const ALL_SALARY_ROLES = EXPANDED_SALARY_ROLES
