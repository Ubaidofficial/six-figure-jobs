// lib/roles/synonyms.ts
/**
 * Comprehensive Role Synonyms for Six Figure Jobs
 * 
 * This file maps job role slugs to their common synonyms, abbreviations,
 * and alternative titles. Used for intelligent search matching.
 * 
 * Categories:
 * - Engineering & Technical
 * - Data & Analytics
 * - Product & Design
 * - Marketing & Content
 * - Sales & Business Development
 * - Operations & Finance
 * - Human Resources & Legal
 * - Executive & Leadership
 * - Creative & Miscellaneous
 */

export interface RoleSynonyms {
  [roleSlug: string]: string[]
}

// ═══════════════════════════════════════════════════════════════════════
//                    ENGINEERING & TECHNICAL ROLES
// ═══════════════════════════════════════════════════════════════════════

export const ENGINEERING_SYNONYMS: RoleSynonyms = {
  'software-engineer': [
    'swe', 'developer', 'programmer', 'coder', 'software dev', 'engineer',
    'coding', 'development engineer', 'application developer', 'software developer',
    'dev', 'eng', 'software engineering'
  ],
  
  'frontend-engineer': [
    'frontend', 'front-end', 'fe', 'ui engineer', 'react developer',
    'vue developer', 'angular developer', 'web developer', 'javascript developer',
    'frontend dev', 'ui developer', 'web engineer', 'client side', 'react',
    'vue', 'angular', 'svelte', 'nextjs', 'next.js'
  ],
  
  'backend-engineer': [
    'backend', 'back-end', 'be', 'server engineer', 'api engineer',
    'backend dev', 'server developer', 'api developer', 'microservices',
    'java developer', 'python developer', 'node developer', 'go developer',
    'golang', 'ruby', 'php', 'server side', 'api', 'rest', 'graphql'
  ],
  
  'full-stack-engineer': [
    'fullstack', 'full-stack', 'full stack developer', 'fullstack dev',
    'web developer', 'application developer', 'stack engineer', 'full stack',
    'mern', 'mean', 'lamp', 'jamstack'
  ],
  
  'mobile-engineer': [
    'mobile developer', 'ios developer', 'android developer', 'mobile dev',
    'ios engineer', 'android engineer', 'react native', 'flutter developer',
    'swift developer', 'kotlin developer', 'mobile app', 'app developer',
    'xamarin', 'ionic'
  ],
  
  'devops-engineer': [
    'devops', 'sre', 'site reliability engineer', 'infrastructure engineer',
    'platform engineer', 'cloud engineer', 'systems engineer', 'deployment',
    'kubernetes', 'docker', 'aws engineer', 'gcp engineer', 'azure engineer',
    'k8s', 'containers', 'ci/cd', 'jenkins', 'terraform', 'ansible'
  ],
  
  'data-engineer': [
    'data engineering', 'etl engineer', 'data pipeline', 'big data engineer',
    'analytics engineer', 'data infrastructure', 'spark engineer',
    'kafka engineer', 'airflow engineer', 'snowflake engineer', 'etl',
    'data warehouse', 'hadoop', 'hive', 'presto'
  ],
  
  'machine-learning-engineer': [
    'ml engineer', 'mle', 'machine learning', 'ai engineer', 'mlops',
    'deep learning engineer', 'ai/ml', 'tensorflow', 'pytorch', 'nlp engineer',
    'computer vision', 'ml', 'artificial intelligence', 'neural networks'
  ],
  
  'security-engineer': [
    'infosec', 'cybersecurity engineer', 'appsec', 'security', 'penetration tester',
    'security analyst', 'security architect', 'devsecops', 'cloud security',
    'ethical hacker', 'pentester', 'vulnerability', 'infosec engineer'
  ],
  
  'qa-engineer': [
    'qa', 'quality assurance', 'test engineer', 'sdet', 'automation engineer',
    'test automation', 'testing', 'quality engineer', 'qae', 'qa automation',
    'selenium', 'cypress', 'playwright', 'test'
  ],
  
  'embedded-engineer': [
    'embedded', 'firmware engineer', 'embedded systems', 'iot engineer',
    'hardware engineer', 'embedded software', 'rtos', 'c++ embedded',
    'embedded dev', 'microcontroller', 'fpga'
  ],
  
  'cloud-engineer': [
    'cloud', 'aws', 'azure', 'gcp', 'cloud architect', 'cloud infrastructure',
    'cloud solutions', 'cloud computing', 'cloud platform'
  ],
  
  'systems-engineer': [
    'systems', 'linux engineer', 'unix engineer', 'systems admin',
    'sysadmin', 'infrastructure', 'network engineer'
  ]
}

// ═══════════════════════════════════════════════════════════════════════
//                    DATA & ANALYTICS ROLES
// ═══════════════════════════════════════════════════════════════════════

export const DATA_SYNONYMS: RoleSynonyms = {
  'data-scientist': [
    'ds', 'data science', 'ml scientist', 'research scientist', 'applied scientist',
    'analytics scientist', 'quantitative researcher', 'statistician',
    'data scientist', 'modeling', 'predictive analytics'
  ],
  
  'data-analyst': [
    'analyst', 'business analyst', 'analytics', 'bi analyst', 'reporting analyst',
    'insights analyst', 'sql analyst', 'tableau analyst', 'power bi',
    'data analysis', 'business intelligence analyst', 'reporting'
  ],
  
  'business-intelligence': [
    'bi', 'business intelligence analyst', 'bi developer', 'data analyst',
    'reporting', 'analytics engineer', 'bi engineer', 'tableau', 'looker',
    'power bi', 'qlik', 'business intelligence'
  ],
  
  'research-scientist': [
    'researcher', 'ai researcher', 'ml researcher', 'phd researcher',
    'research engineer', 'applied research', 'computer vision researcher',
    'nlp researcher', 'research', 'scientist'
  ],
  
  'analytics-engineer': [
    'analytics', 'dbt', 'data modeling', 'analytics engineering',
    'data transformation', 'sql engineer'
  ]
}

// ═══════════════════════════════════════════════════════════════════════
//                    PRODUCT & DESIGN ROLES
// ═══════════════════════════════════════════════════════════════════════

export const PRODUCT_SYNONYMS: RoleSynonyms = {
  'product-manager': [
    'pm', 'product', 'pmo', 'product owner', 'technical pm', 'senior pm',
    'staff pm', 'principal pm', 'group pm', 'director of product',
    'product management', 'product lead', 'po', 'tpm'
  ],
  
  'product-designer': [
    'designer', 'ux designer', 'ui designer', 'ui/ux', 'product design',
    'interaction designer', 'visual designer', 'digital designer',
    'ux/ui', 'user experience', 'user interface', 'figma', 'sketch'
  ],
  
  'ux-researcher': [
    'user researcher', 'ux research', 'user experience researcher',
    'design researcher', 'usability researcher', 'research designer',
    'ux researcher', 'user research'
  ],
  
  'product-marketing-manager': [
    'pmm', 'product marketing', 'go-to-market', 'gtm', 'growth pm',
    'marketing manager', 'product marketer', 'product marketing manager'
  ],
  
  'ux-writer': [
    'content designer', 'ux content', 'content strategist', 'microcopy',
    'product writer', 'ux writing'
  ]
}

// ═══════════════════════════════════════════════════════════════════════
//                    MARKETING & CONTENT ROLES
// ═══════════════════════════════════════════════════════════════════════

export const MARKETING_SYNONYMS: RoleSynonyms = {
  'content-writer': [
    'writer', 'content creator', 'copywriter', 'content marketing',
    'blog writer', 'technical writer', 'content specialist', 'editor',
    'editorial', 'content strategist', 'journalist', 'communications',
    'content', 'writing', 'articles', 'blogging', 'content creation'
  ],
  
  'copywriter': [
    'copy writer', 'creative writer', 'advertising copywriter', 'marketing writer',
    'content writer', 'brand copywriter', 'copy', 'creative copywriter',
    'copywriting', 'ad copy', 'marketing copy', 'sales copy'
  ],
  
  'seo-specialist': [
    'seo', 'search engine optimization', 'seo manager', 'seo strategist',
    'organic search', 'seo analyst', 'search marketing', 'technical seo',
    'seo expert', 'search optimization', 'sem', 'search engine marketing'
  ],
  
  'content-marketing-manager': [
    'content marketing', 'content manager', 'content strategy', 'content lead',
    'content director', 'editorial manager', 'content ops', 'content head'
  ],
  
  'marketing-manager': [
    'marketer', 'marketing', 'digital marketing', 'growth marketing',
    'performance marketing', 'marketing lead', 'brand manager',
    'marketing coordinator', 'marketing specialist'
  ],
  
  'social-media-manager': [
    'social media', 'community manager', 'social marketing', 'social strategist',
    'social media strategist', 'social content', 'community lead',
    'social media coordinator', 'smm', 'community'
  ],
  
  'growth-marketer': [
    'growth', 'growth hacker', 'growth marketing', 'user acquisition',
    'performance marketing', 'demand gen', 'growth lead', 'growth manager',
    'acquisition marketing', 'demand generation'
  ],
  
  'email-marketing': [
    'email marketer', 'crm marketing', 'lifecycle marketing', 'retention marketing',
    'email specialist', 'marketing automation', 'drip campaigns', 'email campaigns',
    'email marketing manager', 'mailchimp', 'hubspot'
  ],
  
  'brand-manager': [
    'brand', 'branding', 'brand strategist', 'brand marketing',
    'brand lead', 'brand director'
  ],
  
  'marketing-operations': [
    'marketing ops', 'mops', 'marketing operations manager', 'revenue ops',
    'revops', 'marketing automation'
  ]
}

// ═══════════════════════════════════════════════════════════════════════
//                    SALES & BUSINESS DEVELOPMENT
// ═══════════════════════════════════════════════════════════════════════

export const SALES_SYNONYMS: RoleSynonyms = {
  'sales-engineer': [
    'se', 'solutions engineer', 'pre-sales', 'technical sales', 'sales engineering',
    'solution architect', 'customer engineer', 'field engineer', 'presales',
    'sales engineer', 'technical account manager'
  ],
  
  'account-executive': [
    'ae', 'sales rep', 'sales representative', 'account manager', 'sales',
    'enterprise sales', 'b2b sales', 'saas sales', 'sales specialist',
    'sales exec', 'closer', 'account exec'
  ],
  
  'business-development': [
    'bd', 'bdr', 'business development rep', 'partnerships', 'partnerships manager',
    'strategic partnerships', 'alliances', 'channel sales', 'business development manager',
    'partnership manager', 'alliance manager'
  ],
  
  'sales-manager': [
    'sales lead', 'sales director', 'head of sales', 'vp sales', 'sales leadership',
    'sales manager', 'sales team lead'
  ],
  
  'customer-success': [
    'csm', 'customer success manager', 'account manager', 'client success',
    'customer success engineer', 'technical account manager', 'tam',
    'customer success', 'cs manager', 'client manager'
  ],
  
  'account-manager': [
    'am', 'client manager', 'relationship manager', 'key account manager',
    'strategic account manager', 'enterprise account manager', 'kam'
  ],
  
  'sales-development': [
    'sdr', 'sales development rep', 'lead generation', 'outbound sales',
    'inside sales', 'sales development representative'
  ]
}

// ═══════════════════════════════════════════════════════════════════════
//                    OPERATIONS & FINANCE
// ═══════════════════════════════════════════════════════════════════════

export const OPERATIONS_SYNONYMS: RoleSynonyms = {
  'operations-manager': [
    'ops', 'operations', 'business operations', 'program manager',
    'ops lead', 'operations lead', 'chief of staff', 'biz ops',
    'business ops', 'operations manager', 'operations director'
  ],
  
  'financial-analyst': [
    'finance analyst', 'fp&a', 'financial planning', 'corporate finance',
    'investment analyst', 'finance', 'financial modeling', 'fpa',
    'financial analyst', 'finance manager'
  ],
  
  'accountant': [
    'accounting', 'cpa', 'senior accountant', 'staff accountant',
    'accounting manager', 'controller', 'financial accountant',
    'accountant', 'bookkeeper', 'accounts'
  ],
  
  'program-manager': [
    'pmo', 'program', 'project manager', 'tpm', 'technical program manager',
    'delivery manager', 'program lead', 'project lead', 'pm',
    'program management', 'project management'
  ],
  
  'strategy-consultant': [
    'consultant', 'management consultant', 'strategy', 'strategic advisor',
    'business consultant', 'strategy manager', 'strategic planning',
    'strategy consultant', 'management consulting'
  ],
  
  'supply-chain': [
    'supply chain manager', 'logistics', 'procurement', 'supply chain',
    'operations planning', 'supply chain analyst'
  ]
}

// ═══════════════════════════════════════════════════════════════════════
//                    HUMAN RESOURCES & LEGAL
// ═══════════════════════════════════════════════════════════════════════

export const HR_LEGAL_SYNONYMS: RoleSynonyms = {
  'recruiter': [
    'talent acquisition', 'technical recruiter', 'recruiting', 'hr recruiter',
    'sourcer', 'talent', 'hiring manager', 'recruitment specialist',
    'recruiter', 'ta', 'recruiting coordinator', 'talent partner'
  ],
  
  'hr-manager': [
    'human resources', 'hr', 'people operations', 'people ops', 'hrbp',
    'hr business partner', 'people manager', 'talent manager',
    'hr manager', 'human resources manager', 'people team'
  ],
  
  'compensation-analyst': [
    'compensation', 'total rewards', 'benefits analyst', 'comp analyst',
    'rewards analyst', 'comp & benefits', 'compensation manager'
  ],
  
  'legal-counsel': [
    'lawyer', 'attorney', 'corporate counsel', 'general counsel', 'legal',
    'in-house counsel', 'corporate lawyer', 'legal advisor',
    'legal counsel', 'counsel', 'legal team'
  ],
  
  'compliance-manager': [
    'compliance', 'risk manager', 'regulatory', 'compliance officer',
    'governance', 'risk and compliance', 'audit', 'compliance manager'
  ]
}

// ═══════════════════════════════════════════════════════════════════════
//                    EXECUTIVE & LEADERSHIP
// ═══════════════════════════════════════════════════════════════════════

export const EXECUTIVE_SYNONYMS: RoleSynonyms = {
  'chief-technology-officer': [
    'cto', 'vp engineering', 'head of engineering', 'engineering director',
    'vp technology', 'technical director', 'chief engineer', 'chief technology officer',
    'vp eng', 'cto', 'head of tech'
  ],
  
  'chief-product-officer': [
    'cpo', 'vp product', 'head of product', 'product director',
    'chief product', 'product leadership', 'chief product officer', 'vp of product'
  ],
  
  'chief-executive-officer': [
    'ceo', 'chief executive', 'founder', 'co-founder', 'president',
    'managing director', 'general manager', 'chief executive officer', 'cofounder'
  ],
  
  'chief-financial-officer': [
    'cfo', 'vp finance', 'finance director', 'head of finance',
    'chief financial', 'financial director', 'chief financial officer'
  ],
  
  'chief-marketing-officer': [
    'cmo', 'vp marketing', 'head of marketing', 'marketing director',
    'chief marketing', 'marketing leadership', 'chief marketing officer'
  ],
  
  'engineering-manager': [
    'eng manager', 'engineering lead', 'tech lead manager', 'team lead',
    'development manager', 'software engineering manager', 'em',
    'engineering manager', 'tech lead', 'tl'
  ],
  
  'director-of-engineering': [
    'engineering director', 'director engineering', 'head of engineering',
    'senior engineering manager', 'engineering leadership', 'director of engineering'
  ],
  
  'chief-operating-officer': [
    'coo', 'chief operating officer', 'vp operations', 'head of operations',
    'operations director'
  ],
  
  'vice-president': [
    'vp', 'vice president', 'svp', 'senior vice president', 'evp',
    'executive vice president'
  ]
}

// ═══════════════════════════════════════════════════════════════════════
//                    CREATIVE & MISCELLANEOUS
// ═══════════════════════════════════════════════════════════════════════

export const CREATIVE_SYNONYMS: RoleSynonyms = {
  'graphic-designer': [
    'designer', 'visual designer', 'brand designer', 'digital designer',
    'creative designer', 'art director', 'design lead', 'graphic designer',
    'graphic design', 'illustrator'
  ],
  
  'video-editor': [
    'editor', 'video producer', 'motion graphics', 'post-production',
    'multimedia editor', 'content producer', 'videographer', 'video editor',
    'video editing', 'premiere', 'after effects'
  ],
  
  'project-manager': [
    'pm', 'project lead', 'delivery manager', 'scrum master', 'agile coach',
    'project coordinator', 'program coordinator', 'project manager',
    'project management', 'agile', 'scrum'
  ]
}

// ═══════════════════════════════════════════════════════════════════════
//                    COMBINED SYNONYMS EXPORT
// ═══════════════════════════════════════════════════════════════════════

export const ROLE_SYNONYMS: RoleSynonyms = {
  ...ENGINEERING_SYNONYMS,
  ...DATA_SYNONYMS,
  ...PRODUCT_SYNONYMS,
  ...MARKETING_SYNONYMS,
  ...SALES_SYNONYMS,
  ...OPERATIONS_SYNONYMS,
  ...HR_LEGAL_SYNONYMS,
  ...EXECUTIVE_SYNONYMS,
  ...CREATIVE_SYNONYMS,
}

// ═══════════════════════════════════════════════════════════════════════
//                    HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Find matching role slugs for a given search query
 * @param query - User's search input
 * @returns Array of matching role slugs
 */
export function findMatchingRoles(query: string): string[] {
  const normalizedQuery = query.toLowerCase().trim()
  const matches: string[] = []
  
  for (const [roleSlug, synonyms] of Object.entries(ROLE_SYNONYMS)) {
    // Check if query matches the role slug itself
    if (roleSlug.includes(normalizedQuery) || normalizedQuery.includes(roleSlug.replace(/-/g, ' '))) {
      matches.push(roleSlug)
      continue
    }
    
    // Check if query matches any synonym
    for (const synonym of synonyms) {
      if (
        synonym.toLowerCase() === normalizedQuery ||
        synonym.toLowerCase().includes(normalizedQuery) ||
        normalizedQuery.includes(synonym.toLowerCase())
      ) {
        matches.push(roleSlug)
        break
      }
    }
  }
  
  return [...new Set(matches)] // Remove duplicates
}

/**
 * Get all synonyms for a given role slug
 * @param roleSlug - The role identifier
 * @returns Array of synonyms or empty array if not found
 */
export function getSynonymsForRole(roleSlug: string): string[] {
  return ROLE_SYNONYMS[roleSlug] || []
}

/**
 * Get human-readable role title from slug
 * @param roleSlug - The role identifier (e.g., 'software-engineer')
 * @returns Human-readable title (e.g., 'Software Engineer')
 */
export function getRoleTitleFromSlug(roleSlug: string): string {
  return roleSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Get category for a role slug
 * @param roleSlug - The role identifier
 * @returns Category name
 */
export function getRoleCategory(roleSlug: string): string {
  if (roleSlug in ENGINEERING_SYNONYMS) return 'Engineering'
  if (roleSlug in DATA_SYNONYMS) return 'Data & Analytics'
  if (roleSlug in PRODUCT_SYNONYMS) return 'Product & Design'
  if (roleSlug in MARKETING_SYNONYMS) return 'Marketing & Content'
  if (roleSlug in SALES_SYNONYMS) return 'Sales & Business Development'
  if (roleSlug in OPERATIONS_SYNONYMS) return 'Operations & Finance'
  if (roleSlug in HR_LEGAL_SYNONYMS) return 'Human Resources & Legal'
  if (roleSlug in EXECUTIVE_SYNONYMS) return 'Executive & Leadership'
  if (roleSlug in CREATIVE_SYNONYMS) return 'Creative'
  
  return 'Other'
}

/**
 * Search roles with fuzzy matching
 * Uses Levenshtein distance for approximate matching
 * @param query - User's search input
 * @param threshold - Maximum edit distance (default: 2)
 * @returns Array of matching role slugs sorted by relevance
 */
export function fuzzySearchRoles(query: string, threshold: number = 2): Array<{ roleSlug: string; score: number }> {
  const normalizedQuery = query.toLowerCase().trim()
  const results: Array<{ roleSlug: string; score: number }> = []
  
  for (const [roleSlug, synonyms] of Object.entries(ROLE_SYNONYMS)) {
    let bestScore = Infinity
    
    // Check role slug
    const slugWords = roleSlug.replace(/-/g, ' ')
    const slugDistance = levenshteinDistance(normalizedQuery, slugWords)
    if (slugDistance <= threshold) {
      bestScore = Math.min(bestScore, slugDistance)
    }
    
    // Check each synonym
    for (const synonym of synonyms) {
      const distance = levenshteinDistance(normalizedQuery, synonym.toLowerCase())
      if (distance <= threshold) {
        bestScore = Math.min(bestScore, distance)
      }
    }
    
    if (bestScore !== Infinity) {
      results.push({ roleSlug, score: bestScore })
    }
  }
  
  // Sort by score (lower is better)
  return results.sort((a, b) => a.score - b.score)
}

/**
 * Calculate Levenshtein distance between two strings
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

// ═══════════════════════════════════════════════════════════════════════
//                    EXPORTS
// ═══════════════════════════════════════════════════════════════════════

export default ROLE_SYNONYMS