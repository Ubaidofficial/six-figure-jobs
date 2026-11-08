// lib/roles/searchRoles.ts
// Broad role/type list for search dropdowns (mirrors examples in the provided UI screenshots)
import { findMatchingRoles, getRoleTitleFromSlug } from './synonyms'
export type SearchRoleOption = {
  slug: string
  label: string
  emoji: string
  category?: string
  salaryRange?: string
}

export const SEARCH_ROLE_OPTIONS: SearchRoleOption[] = [
  // Creative / Design
  { slug: '2d-artist', label: '2D Artist', emoji: '🎨', category: 'Design' },
  { slug: '3d-artist', label: '3D Artist', emoji: '🗿', category: 'Design' },
  { slug: 'art-director', label: 'Art Director', emoji: '🎭', category: 'Design' },
  { slug: 'graphic-designer', label: 'Graphics Designer', emoji: '✍️', category: 'Design' },
  { slug: 'creative-strategist', label: 'Creative Strategist', emoji: '🎨', category: 'Design' },
  { slug: 'brand-designer', label: 'Brand Designer', emoji: '🎨', category: 'Design' },
  { slug: 'brand-ambassador', label: 'Brand Ambassador', emoji: '🎭', category: 'Design' },
  { slug: 'product-designer', label: 'Product Designer (UI/UX)', emoji: '🎨', category: 'Design' },
  { slug: 'web-designer', label: 'Web Designer', emoji: '🕸️', category: 'Design' },
  { slug: 'video-editor', label: 'Video Editor', emoji: '🎬', category: 'Design' },

  // Writing / Content / Comms
  { slug: 'content-marketing-manager', label: 'Content Marketing Manager', emoji: '🖋️', category: 'Content & Communications' },
  { slug: 'content-manager', label: 'Content Manager', emoji: '👩‍💻', category: 'Content & Communications' },
  { slug: 'content-writer', label: 'Content Writer', emoji: '✏️', category: 'Content & Communications' },
  { slug: 'copywriter', label: 'Copywriter', emoji: '📝', category: 'Content & Communications' },
  { slug: 'content-creator', label: 'Content Creator', emoji: '💼', category: 'Content & Communications' },
  { slug: 'public-relations', label: 'Public Relations (PR)', emoji: '📰', category: 'Content & Communications' },
  { slug: 'communications', label: 'Communications', emoji: '📢', category: 'Content & Communications' },

  // Sales / GTM
  { slug: 'account-executive', label: 'Account Executive', emoji: '🧑‍💼', category: 'Sales' },
  { slug: 'account-manager', label: 'Account Manager', emoji: '💰', category: 'Sales' },
  { slug: 'customer-success', label: 'Customer Success', emoji: '🏆', category: 'Sales' },
  { slug: 'customer-support', label: 'Customer Support', emoji: '💖', category: 'Sales' },
  { slug: 'customer-retention-specialist', label: 'Customer Retention Specialist', emoji: '🔄', category: 'Sales' },
  { slug: 'sales-development-representative', label: 'Sales Development (SDR)', emoji: '💸', category: 'Sales' },
  { slug: 'sales-engineer', label: 'Sales Engineer', emoji: '🧭', category: 'Sales' },
  { slug: 'sales-operations', label: 'Sales Operations', emoji: '📊', category: 'Sales' },
  { slug: 'revenue-operations', label: 'Revenue Operations', emoji: '✅', category: 'Sales' },
  { slug: 'inside-sales', label: 'Inside Sales', emoji: '⬇️', category: 'Sales' },
  { slug: 'outside-sales', label: 'Outside Sales', emoji: '🌆', category: 'Sales' },
  { slug: 'pre-sales-engineer', label: 'Pre-sales Engineer', emoji: '🔍', category: 'Sales' },
  { slug: 'salesforce-administrator', label: 'Salesforce Administrator', emoji: '🌐🧑‍💼', category: 'Sales' },
  { slug: 'salesforce-analyst', label: 'Salesforce Analyst', emoji: '🌐🧑‍💻', category: 'Sales' },
  { slug: 'client-partner', label: 'Client Partner', emoji: '🤝', category: 'Sales' },
  { slug: 'client-services', label: 'Client Services', emoji: '🗂️', category: 'Sales' },

  // Marketing / Growth
  { slug: 'marketing', label: 'Marketing', emoji: '🎡', category: 'Marketing' },
  { slug: 'marketing-analyst', label: 'Marketing Analyst', emoji: '📊', category: 'Marketing' },
  { slug: 'marketing-operations', label: 'Marketing Operations', emoji: '⚙️', category: 'Marketing' },
  { slug: 'growth-marketing', label: 'Growth Marketing', emoji: '📈', category: 'Marketing' },
  { slug: 'performance-marketing', label: 'Performance Marketing', emoji: '📈', category: 'Marketing' },
  { slug: 'seo-marketing', label: 'SEO Marketing', emoji: '📉', category: 'Marketing' },
  { slug: 'email-marketing-manager', label: 'Email Marketing Manager', emoji: '✉️', category: 'Marketing' },
  { slug: 'digital-marketing', label: 'Digital Marketing', emoji: '🌐', category: 'Marketing' },
  { slug: 'social-media-manager', label: 'Social Media Manager', emoji: '💕', category: 'Marketing' },
  { slug: 'influencer-marketing', label: 'Influencer Marketing', emoji: '💅', category: 'Marketing' },
  { slug: 'product-marketing', label: 'Product Marketing', emoji: '🎁', category: 'Marketing' },

  // Product / Program / Ops
  { slug: 'product-manager', label: 'Product Manager', emoji: '✅', category: 'Product' },
  { slug: 'product-operations', label: 'Product Operations', emoji: '⚡', category: 'Product' },
  { slug: 'product-specialist', label: 'Product Specialist', emoji: '🪄', category: 'Product' },
  { slug: 'program-manager', label: 'Program Manager', emoji: '📋', category: 'Product' },
  { slug: 'project-manager', label: 'Project Manager', emoji: '👷', category: 'Product' },
  { slug: 'technical-program-manager', label: 'Technical Program Manager', emoji: '🔧', category: 'Product' },
  { slug: 'technical-project-manager', label: 'Technical Project Manager', emoji: '🧠', category: 'Product' },
  { slug: 'product-analyst', label: 'Product Analyst', emoji: '🔍', category: 'Product' },
  { slug: 'product-adoption-specialist', label: 'Product Adoption Specialist', emoji: '🌱', category: 'Product' },

  // Engineering (software + infra)
  { slug: 'software-engineer', label: 'Software Engineer', emoji: '💻', category: 'Software Engineering' },
  { slug: 'backend-engineer', label: 'Backend Engineer', emoji: '🖥️', category: 'Software Engineering' },
  { slug: 'frontend-engineer', label: 'Frontend Engineer / Web Developer', emoji: '🖥️', category: 'Software Engineering' },
  { slug: 'full-stack-engineer', label: 'Full-stack Engineer', emoji: '🧑‍💻', category: 'Software Engineering' },
  { slug: 'android-engineer', label: 'Android Engineer', emoji: '🤖', category: 'Software Engineering' },
  { slug: 'ios-engineer', label: 'iOS Engineer', emoji: '🍏', category: 'Software Engineering' },
  { slug: 'devops-engineer', label: 'DevOps & Site Reliability Engineer (SRE)', emoji: '🚨', category: 'Software Engineering' },
  { slug: 'platform-engineer', label: 'Platform Engineer', emoji: '🏗️', category: 'Software Engineering' },
  { slug: 'application-engineer', label: 'Application Engineer', emoji: '💻', category: 'Software Engineering' },
  { slug: 'systems-engineer', label: 'Systems Engineer', emoji: '⚙️', category: 'Software Engineering' },
  { slug: 'solutions-engineer', label: 'Solutions Engineer', emoji: '💻', category: 'Software Engineering' },
  { slug: 'qa-engineer', label: 'QA Engineer (Quality Assurance)', emoji: '🔧', category: 'Software Engineering' },
  { slug: 'qa-automation-engineer', label: 'QA Automation Engineer', emoji: '🤖', category: 'Software Engineering' },
  { slug: 'security-engineer', label: 'Cybersecurity / Security Engineer', emoji: '🛡️', category: 'Software Engineering' },
  { slug: 'security-analyst', label: 'Security Analyst', emoji: '🔒', category: 'Software Engineering' },
  { slug: 'incident-response-analyst', label: 'Incident Response Analyst', emoji: '🩸', category: 'Software Engineering' },
  { slug: 'threat-intelligence-specialist', label: 'Threat Intelligence Specialist', emoji: '🕵️‍♂️', category: 'Software Engineering' },
  { slug: 'hardware-engineer', label: 'Hardware Engineer', emoji: '🔧', category: 'Software Engineering' },
  { slug: 'field-service-engineer', label: 'Field Service Engineer', emoji: '🔧', category: 'Software Engineering' },
  { slug: 'implementation-specialist', label: 'Implementation Specialist', emoji: '🛠️', category: 'Software Engineering' },
  { slug: 'service-now', label: 'ServiceNow', emoji: '🔧', category: 'Software Engineering' },
  { slug: 'sap-consultant', label: 'SAP Consultant', emoji: '🖥️', category: 'Software Engineering' },
  { slug: 'smart-contract-engineer', label: 'Smart Contract Engineer', emoji: '📜', category: 'Software Engineering' },
  { slug: 'solutions-architect', label: 'Architect', emoji: '🏛️', category: 'Software Engineering' },

  // Data / Analytics / ML
  { slug: 'data-analyst', label: 'Data Analyst', emoji: '📄', category: 'Data & AI' },
  { slug: 'data-engineer', label: 'Data Engineer', emoji: '🧪', category: 'Data & AI' },
  { slug: 'data-scientist', label: 'Data Scientist', emoji: '📊', category: 'Data & AI' },
  { slug: 'analytics-engineer', label: 'Analytics Engineer', emoji: '📊', category: 'Data & AI' },
  { slug: 'business-analyst', label: 'Business Analyst', emoji: '🤔', category: 'Data & AI' },
  { slug: 'business-intelligence-analyst', label: 'Business Intelligence Analyst', emoji: '📚', category: 'Data & AI' },
  { slug: 'business-intelligence-developer', label: 'Business Intelligence Developer', emoji: '📊', category: 'Data & AI' },
  { slug: 'database-administrator', label: 'Database Administrator', emoji: '💿', category: 'Data & AI' },
  { slug: 'data-entry', label: 'Data Entry', emoji: '⬇️', category: 'Data & AI' },
  { slug: 'ml-engineer', label: 'Machine Learning Engineer', emoji: '🤖', category: 'Data & AI' },
  { slug: 'ml-researcher', label: 'Research Scientist', emoji: '🧪', category: 'Data & AI' },
  { slug: 'llm-engineer', label: 'LLM Engineer', emoji: '🧠', category: 'Data & AI' },
  { slug: 'ai-engineer', label: 'AI Engineer', emoji: '🤖', category: 'Data & AI' },
  { slug: 'ai-research-scientist', label: 'AI Research Scientist', emoji: '🧠', category: 'Data & AI' },
  { slug: 'computer-vision-engineer', label: 'Computer Vision Engineer', emoji: '👁️', category: 'Data & AI' },
  { slug: 'nlp-engineer', label: 'NLP Engineer', emoji: '📜', category: 'Data & AI' },

  // Finance / Accounting / Legal
  { slug: 'accounting-manager', label: 'Accounting Manager', emoji: '🧾', category: 'Finance & Legal' },
  { slug: 'accountant', label: 'Accountant / Accounting', emoji: '💲', category: 'Finance & Legal' },
  { slug: 'accounts-payable', label: 'Accounts Payable', emoji: '🧾', category: 'Finance & Legal' },
  { slug: 'accounts-receivable', label: 'Accounts Receivable', emoji: '🧾', category: 'Finance & Legal' },
  { slug: 'financial-controller', label: 'Financial Controller', emoji: '⛔', category: 'Finance & Legal' },
  { slug: 'financial-planning-analysis', label: 'Financial Planning and Analysis (FP&A)', emoji: '🐝', category: 'Finance & Legal' },
  { slug: 'aml-financial-crime', label: 'AML and Financial Crime', emoji: '🆘', category: 'Finance & Legal' },
  { slug: 'tax', label: 'Tax', emoji: '💰', category: 'Finance & Legal' },
  { slug: 'pricing-analyst', label: 'Pricing Analyst', emoji: '💰', category: 'Finance & Legal' },
  { slug: 'payroll', label: 'Payroll', emoji: '🧾', category: 'Finance & Legal' },
  { slug: 'actuary', label: 'Actuary', emoji: '📊', category: 'Finance & Legal' },
  { slug: 'underwriter', label: 'Underwriter', emoji: '📋', category: 'Finance & Legal' },
  { slug: 'legal-assistant', label: 'Legal Assistant', emoji: '⚖️', category: 'Finance & Legal' },
  { slug: 'paralegal', label: 'Paralegal', emoji: '💼', category: 'Finance & Legal' },
  { slug: 'general-counsel', label: 'General Counsel', emoji: '🧠', category: 'Finance & Legal' },

  // People / HR / Recruiting
  { slug: 'people-operations', label: 'People Operations', emoji: '👥', category: 'People & HR' },
  { slug: 'human-resources', label: 'Human Resources (HR)', emoji: '🧑‍🤝‍🧑', category: 'People & HR' },
  { slug: 'recruiter', label: 'Recruiter', emoji: '🎯', category: 'People & HR' },
  { slug: 'technical-recruiter', label: 'Technical Recruiter', emoji: '👀', category: 'People & HR' },
  { slug: 'technical-account-manager', label: 'Technical Account Manager', emoji: '🧑‍💼', category: 'People & HR' },
  { slug: 'technical-customer-success-manager', label: 'Technical Customer Success Manager', emoji: '🧑‍💼', category: 'People & HR' },

  // Ops / Admin
  { slug: 'operations', label: 'Operations', emoji: '⚙️', category: 'Operations' },
  { slug: 'business-operations', label: 'Business Operations', emoji: '⚙️', category: 'Operations' },
  { slug: 'administration', label: 'Administration', emoji: '💻', category: 'Operations' },
  { slug: 'administrative-assistant', label: 'Administrative Assistant', emoji: '🗒️', category: 'Operations' },
  { slug: 'executive-assistant', label: 'Executive Assistant', emoji: '🧑‍💼', category: 'Operations' },
  { slug: 'office-manager', label: 'Manager', emoji: '🏢', category: 'Operations' },
  { slug: 'strategy', label: 'Strategy', emoji: '🧠', category: 'Operations' },
  { slug: 'supply-chain', label: 'Supply Chain', emoji: '🔗', category: 'Operations' },
  { slug: 'procurement', label: 'Procurement', emoji: '🛒', category: 'Operations' },
  { slug: 'operations-manager', label: 'Operations Manager', emoji: '⚙️', category: 'Operations' },
  { slug: 'program-manager', label: 'Program Manager', emoji: '📋', category: 'Operations' },

  // Leadership
  { slug: 'chief-operating-officer', label: 'Chief Operating Officer (COO)', emoji: '🏢', category: 'Leadership' },
  { slug: 'chief-technology-officer', label: 'Chief Technology Officer (CTO)', emoji: '👩‍💻', category: 'Leadership' },
  { slug: 'chief-marketing-officer', label: 'Chief Marketing Officer (CMO)', emoji: '🎯', category: 'Leadership' },
  { slug: 'chief-of-staff', label: 'Chief of Staff', emoji: '🧑‍✈️', category: 'Leadership' },
  { slug: 'vice-president', label: 'Vice President', emoji: '🏢', category: 'Leadership' },
  { slug: 'director', label: 'Director', emoji: '🧭', category: 'Leadership' },
  { slug: 'manager', label: 'Manager', emoji: '🏙️', category: 'Leadership' },

  // Healthcare / Bio
  { slug: 'clinical-operations', label: 'Clinical Operations', emoji: '🏥', category: 'Healthcare' },
  { slug: 'clinical-research', label: 'Clinical Research', emoji: '🧪', category: 'Healthcare' },
  { slug: 'medical-director', label: 'Medical Director', emoji: '🧑‍⚕️', category: 'Healthcare' },
  { slug: 'medical-reviewer', label: 'Medical Reviewer', emoji: '🔍🏥', category: 'Healthcare' },
  { slug: 'therapist', label: 'Therapist', emoji: '🧠', category: 'Healthcare' },

  // Engineering (hardware / mech / civil)
  { slug: 'electrical-engineer', label: 'Electrical Engineer', emoji: '🔋', category: 'Hardware Engineering' },
  { slug: 'mechanical-engineer', label: 'Mechanical Engineer', emoji: '🧑‍🔧', category: 'Hardware Engineering' },
  { slug: 'civil-engineer', label: 'Civil Engineer', emoji: '🗼', category: 'Hardware Engineering' },

  // Science / Research
  { slug: 'research-analyst', label: 'Research Analyst', emoji: '🔬', category: 'Science & Research' },
  { slug: 'research-engineer', label: 'Research Engineer', emoji: '📚', category: 'Science & Research' },
  { slug: 'research-scientist', label: 'Research Scientist', emoji: '🧪', category: 'Science & Research' },

  // Other specialized roles
  { slug: 'bookkeeping', label: 'Bookkeeping and Clerks', emoji: '👩‍💼' },
  { slug: 'billing-specialist', label: 'Billing Specialist', emoji: '📊' },
  { slug: 'collections', label: 'Collections', emoji: '📞' },
  { slug: 'call-center-representative', label: 'Call Center Representative', emoji: '☎️' },
  { slug: 'community-manager', label: 'Community Manager', emoji: '🧑‍🤝‍🧑' },
  { slug: 'compliance', label: 'Compliance', emoji: '🚗' },
  { slug: 'consultant', label: 'Consultant', emoji: '💼' },
  { slug: 'counselor', label: 'Counselor', emoji: '🧘' },
  { slug: 'crypto', label: 'Crypto', emoji: '฿' },
  { slug: 'customer-advocate', label: 'Customer Advocate', emoji: '🗣️' },
  { slug: 'defi', label: 'DeFi', emoji: '🏦' },
  { slug: 'developer-relations', label: 'Developer Relations (DevRel)', emoji: '🤝' },
  { slug: 'ecommerce', label: 'E-commerce', emoji: '🛍️' },
  { slug: 'events', label: 'Events', emoji: '🎪' },
  { slug: 'game-engineer', label: 'Game Engineer', emoji: '🎮' },
  { slug: 'human-resources', label: 'Human Resources (HR)', emoji: '👥' },
  { slug: 'implementation-specialist', label: 'Implementation Specialist', emoji: '🛠️' },
  { slug: 'insurance', label: 'Insurance', emoji: '🔒' },
  { slug: 'it-support', label: 'IT Support', emoji: '💻' },
  { slug: 'journalist', label: 'Journalist', emoji: '🖥️' },
  { slug: 'lead-generation', label: 'Lead Generation', emoji: '📡' },
  { slug: 'learning-and-development', label: 'Learning and Development', emoji: '📚' },
  { slug: 'network-engineer', label: 'Network Engineer', emoji: '📡' },
  { slug: 'network-operations', label: 'Network Operations', emoji: '🌐' },
  { slug: 'notary', label: 'Notary', emoji: '📜' },
  { slug: 'onboarding-specialist', label: 'Onboarding Specialist', emoji: '🚀' },
  { slug: 'operations-analyst', label: 'Operations', emoji: '⚙️' },
  { slug: 'people-operations', label: 'People Operations', emoji: '👥' },
  { slug: 'platform-engineer', label: 'Platform Engineer', emoji: '🏗️' },
  { slug: 'pricing-analyst', label: 'Pricing Analyst', emoji: '💰' },
  { slug: 'producer', label: 'Producer', emoji: '🍿' },
  { slug: 'program-manager', label: 'Program Manager', emoji: '📋' },
  { slug: 'proposal-manager', label: 'Proposal Manager', emoji: '📄' },
  { slug: 'qa-engineer', label: 'QA Engineer (Quality Assurance)', emoji: '🔧' },
  { slug: 'qa-automation-engineer', label: 'QA Automation Engineer', emoji: '🤖' },
  { slug: 'recruiter', label: 'Recruiter', emoji: '🎯' },
  { slug: 'research-analyst', label: 'Research Analyst', emoji: '🔬' },
  { slug: 'research-engineer', label: 'Research Engineer', emoji: '📚' },
  { slug: 'research-scientist', label: 'Research Scientist', emoji: '🧪' },
  { slug: 'risk', label: 'Risk', emoji: '🎲' },
  { slug: 'robotics', label: 'Robotics', emoji: '🤖' },
  { slug: 'sap-consultant', label: 'SAP Consultant', emoji: '🖥️' },
  { slug: 'scrum-master', label: 'Scrum Master + Agile Coach', emoji: '⚡' },
  { slug: 'security-operations', label: 'Security Operations', emoji: '🛡️' },
  { slug: 'servicenow', label: 'ServiceNow', emoji: '🔧' },
  { slug: 'smart-contract-engineer', label: 'Smart Contract Engineer', emoji: '📜' },
  { slug: 'social-media-manager', label: 'Social Media Manager', emoji: '💕' },
  { slug: 'solutions-engineer', label: 'Solutions Engineer', emoji: '💻' },
  { slug: 'software-development-engineer-test', label: 'Software Development Engineer in Test', emoji: '⚡' },
  { slug: 'software-engineer', label: 'Software Engineer', emoji: '💻' },
  { slug: 'support-engineer', label: 'Support Engineer', emoji: '📞' },
  { slug: 'systems-administrator', label: 'Systems Administrator', emoji: '🖥️' },
  { slug: 'tax', label: 'Tax', emoji: '💰' },
  { slug: 'technical-writer', label: 'Technical Writer', emoji: '✍️' },
  { slug: 'technical-product-manager', label: 'Technical Product Manager (TPM)', emoji: '⚒️' },
  { slug: 'translator', label: 'Translator / Interpreter', emoji: '🌍' },
  { slug: 'ux-researcher', label: 'UX Researcher', emoji: '🧪' },
  { slug: 'web3', label: 'Web3', emoji: '🌐' },
]

/**
 * Search roles with synonym matching
 * Uses the ROLE_SYNONYMS from synonyms.ts for intelligent matching
 */
export function searchRolesWithSynonyms(
  query: string,
  options: SearchRoleOption[]
): Array<SearchRoleOption & { matchedSynonym?: string }> {
  const q = query.toLowerCase().trim()
  
  if (!q) return []
  
  // First, try exact slug match
  const exactMatch = options.filter(opt => 
    opt.slug.includes(q) || opt.label.toLowerCase().includes(q)
  )
  
  // Then try synonym matching
  const matchingSlugs = findMatchingRoles(q)
  const synonymMatches = options
    .filter(opt => matchingSlugs.includes(opt.slug))
    .map(opt => ({
      ...opt,
      matchedSynonym: q
    }))
  
  // Combine and deduplicate
  const seen = new Set<string>()
  const results: Array<SearchRoleOption & { matchedSynonym?: string }> = []
  
  for (const item of [...exactMatch, ...synonymMatches]) {
    if (!seen.has(item.slug)) {
      seen.add(item.slug)
      results.push(item)
    }
  }
  
  return results.slice(0, 20)
}
