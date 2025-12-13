// lib/roles/canonicalSlugs.ts
// Master list of canonical role slugs for pSEO pages
// ONLY these slugs are valid for /remote/[role] and /jobs/[role] routes

// ═══════════════════════════════════════════════════════════════════════════
// TIER-1 ROLES: Always indexed (~25 roles with highest search volume)
// ═══════════════════════════════════════════════════════════════════════════

export const TIER_1_ROLES = [
  // Engineering (10)
  'software-engineer',
  'frontend-engineer',
  'backend-engineer',
  'full-stack-engineer',
  'devops-engineer',
  'data-engineer',
  'machine-learning-engineer',
  'ios-engineer',
  'android-engineer',
  'security-engineer',

  // Data (3)
  'data-scientist',
  'data-analyst',
  'analytics-engineer',

  // Product & Design (4)
  'product-manager',
  'product-designer',
  'ux-designer',
  'ux-researcher',

  // Management (3)
  'engineering-manager',
  'technical-program-manager',
  'technical-lead',

  // Business (3)
  'account-executive',
  'customer-success-manager',
  'sales-engineer',

  // Executive (2)
  'vp-engineering',
  'cto',
] as const

// ═══════════════════════════════════════════════════════════════════════════
// TIER-2 ROLES: Valid for redirects but noindex (~125 roles)
// ═══════════════════════════════════════════════════════════════════════════

export const TIER_2_ROLES = [
  // Senior/Staff/Principal variants
  'senior-software-engineer',
  'staff-software-engineer',
  'principal-software-engineer',
  'senior-frontend-engineer',
  'senior-backend-engineer',
  'senior-full-stack-engineer',
  'senior-devops-engineer',
  'senior-data-engineer',
  'staff-data-engineer',
  'senior-machine-learning-engineer',
  'senior-data-scientist',
  'staff-data-scientist',
  'senior-data-analyst',
  'senior-product-manager',
  'group-product-manager',
  'principal-product-manager',
  'senior-product-designer',
  'staff-product-designer',
  'senior-ux-designer',
  'senior-ux-researcher',
  'senior-engineering-manager',
  'senior-account-executive',
  'enterprise-account-executive',
  'senior-customer-success-manager',

  // Additional Engineering
  'site-reliability-engineer',
  'platform-engineer',
  'infrastructure-engineer',
  'cloud-engineer',
  'senior-security-engineer',
  'qa-engineer',
  'senior-qa-engineer',
  'mobile-engineer',
  'embedded-engineer',
  'firmware-engineer',
  'systems-engineer',
  'network-engineer',
  'database-engineer',
  'solutions-engineer',
  'support-engineer',
  'release-engineer',
  'build-engineer',
  'test-engineer',
  'automation-engineer',
  'performance-engineer',
  'reliability-engineer',
  'integration-engineer',
  'api-engineer',
  'protocol-engineer',
  'blockchain-engineer',
  'web-developer',
  'software-developer',
  'application-engineer',
  'systems-administrator',

  // Data & AI/ML
  'ml-engineer',
  'ai-engineer',
  'research-scientist',
  'research-engineer',
  'applied-scientist',
  'data-architect',
  'bi-engineer',
  'bi-analyst',
  'business-intelligence-analyst',
  'mlops-engineer',
  'nlp-engineer',
  'computer-vision-engineer',
  'deep-learning-engineer',
  'ai-researcher',

  // Product & Design
  'director-of-product',
  'vp-product',
  'chief-product-officer',
  'ui-designer',
  'visual-designer',
  'brand-designer',
  'creative-director',
  'head-of-design',
  'design-manager',

  // Engineering Management
  'senior-director-of-engineering',
  'svp-engineering',
  'director-of-engineering',
  'head-of-engineering',
  'tech-lead',
  'team-lead',
  'software-architect',
  'solutions-architect',
  'enterprise-architect',
  'cloud-architect',
  'engineering-director',

  // Business & Sales
  'senior-account-manager',
  'account-manager',
  'customer-success-director',
  'sales-manager',
  'sales-director',
  'vp-sales',
  'head-of-sales',
  'chief-revenue-officer',
  'business-development-manager',
  'business-development-representative',
  'partnerships-manager',
  'channel-manager',
  'revenue-operations-manager',
  'sales-operations-manager',
  'sales-enablement-manager',
  'solution-consultant',
  'pre-sales-engineer',

  // Marketing
  'marketing-manager',
  'senior-marketing-manager',
  'growth-manager',
  'growth-marketing-manager',
  'product-marketing-manager',
  'senior-product-marketing-manager',
  'content-manager',
  'content-marketing-manager',
  'seo-manager',
  'performance-marketing-manager',
  'demand-generation-manager',
  'marketing-director',
  'vp-marketing',
  'cmo',
  'head-of-marketing',

  // Finance & Operations
  'financial-analyst',
  'senior-financial-analyst',
  'finance-manager',
  'controller',
  'cfo',
  'accountant',
  'senior-accountant',
  'tax-manager',
  'operations-manager',
  'operations-director',
  'chief-operating-officer',
  'business-analyst',

  // HR & Recruiting
  'recruiter',
  'senior-recruiter',
  'technical-recruiter',
  'recruiting-manager',
  'hr-manager',
  'hr-business-partner',
  'people-operations-manager',
  'talent-acquisition-manager',
  'head-of-people',
  'chief-people-officer',

  // Executive
  'ceo',
  'coo',
  'cpo',
  'ciso',
  'chief-of-staff',
  'vp-operations',
  'general-manager',
  'managing-director',
  'president',

  // Other
  'technical-writer',
  'senior-technical-writer',
  'program-manager',
  'senior-program-manager',
  'project-manager',
  'senior-project-manager',
  'scrum-master',
  'agile-coach',
  'consultant',
  'strategy-consultant',
  'management-consultant',
  'security-analyst',
  'compliance-manager',
  'legal-counsel',
  'general-counsel',
] as const

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED & TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const CANONICAL_ROLE_SLUGS = [...TIER_1_ROLES, ...TIER_2_ROLES] as const

export type Tier1RoleSlug = (typeof TIER_1_ROLES)[number]
export type Tier2RoleSlug = (typeof TIER_2_ROLES)[number]
export type CanonicalRoleSlug = (typeof CANONICAL_ROLE_SLUGS)[number]

// Sets for O(1) lookup
export const TIER_1_ROLE_SET = new Set<string>(TIER_1_ROLES)
export const TIER_2_ROLE_SET = new Set<string>(TIER_2_ROLES)
export const CANONICAL_ROLE_SET = new Set<string>(CANONICAL_ROLE_SLUGS)

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a slug is in the canonical list (Tier-1 or Tier-2)
 */
export function isCanonicalSlug(slug: string): slug is CanonicalRoleSlug {
  return CANONICAL_ROLE_SET.has(slug)
}

/**
 * Check if a slug is Tier-1 (should be indexed)
 */
export function isTier1Role(slug: string): slug is Tier1RoleSlug {
  return TIER_1_ROLE_SET.has(slug)
}

/**
 * Check if a slug is Tier-2 (valid but noindex)
 */
export function isTier2Role(slug: string): slug is Tier2RoleSlug {
  return TIER_2_ROLE_SET.has(slug)
}

/**
 * Determine if a role page should be indexed
 */
export function shouldIndexRole(slug: string): boolean {
  return TIER_1_ROLE_SET.has(slug)
}

/**
 * Get count of canonical slugs
 */
export function getCanonicalSlugCount(): number {
  return CANONICAL_ROLE_SLUGS.length
}

/**
 * Get count of Tier-1 slugs
 */
export function getTier1SlugCount(): number {
  return TIER_1_ROLES.length
}
