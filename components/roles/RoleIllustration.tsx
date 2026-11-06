import { useId } from 'react'

import { ROLE_ART, drawRoleArt, type RoleArtKey } from './roleArt'

/** Exact role slug (after any seniority prefix is dropped) -> illustration. */
const ART_BY_SLUG: Record<string, RoleArtKey> = {
  'software-engineer': 'software',
  'software-developer': 'software',
  'application-engineer': 'software',
  'api-engineer': 'software',
  'frontend-engineer': 'frontend',
  'web-developer': 'frontend',
  'ui-engineer': 'frontend',
  'backend-engineer': 'backend',
  'database-engineer': 'backend',
  'systems-engineer': 'backend',
  'full-stack-engineer': 'fullstack',
  'devops-engineer': 'devops',
  'site-reliability-engineer': 'devops',
  'platform-engineer': 'devops',
  'infrastructure-engineer': 'devops',
  'cloud-engineer': 'devops',
  'release-engineer': 'devops',
  'data-engineer': 'dataEngineer',
  'analytics-engineer': 'dataEngineer',
  'bi-engineer': 'dataEngineer',
  'data-scientist': 'dataScientist',
  'data-analyst': 'dataScientist',
  'business-intelligence-analyst': 'dataScientist',
  'machine-learning-engineer': 'machineLearning',
  'ml-engineer': 'machineLearning',
  'mlops-engineer': 'machineLearning',
  'ai-engineer': 'machineLearning',
  'llm-engineer': 'machineLearning',
  'generative-ai-engineer': 'machineLearning',
  'nlp-engineer': 'machineLearning',
  'computer-vision-engineer': 'machineLearning',
  'deep-learning-engineer': 'machineLearning',
  'research-scientist': 'machineLearning',
  'applied-scientist': 'machineLearning',
  'ai-researcher': 'machineLearning',
  'ios-engineer': 'mobile',
  'android-engineer': 'mobile',
  'mobile-engineer': 'mobile',
  'security-engineer': 'security',
  'product-manager': 'product',
  'technical-program-manager': 'product',
  'program-manager': 'product',
  'product-designer': 'design',
  'ux-designer': 'design',
  'ui-designer': 'design',
  'ux-researcher': 'design',
  'engineering-manager': 'engManager',
  'director-of-engineering': 'engManager',
  'head-of-engineering': 'engManager',
  'vp-engineering': 'engManager',
  'staff-software-engineer': 'architect',
  'principal-software-engineer': 'architect',
  'software-architect': 'architect',
  'solutions-architect': 'architect',
  'cloud-architect': 'architect',
  'enterprise-architect': 'architect',
  'data-architect': 'architect',
  'technical-lead': 'architect',
  'tech-lead': 'architect',
}

const SENIORITY_PREFIX = /^(senior|staff|principal|lead|junior|associate)-/

/** The illustration key for a role slug; unknown slugs get the generic briefcase. */
export function resolveRoleArt(slug: string | null | undefined): RoleArtKey {
  const s = (slug ?? '').trim().toLowerCase()
  const direct = ART_BY_SLUG[s]
  if (direct) return direct
  const stripped = ART_BY_SLUG[s.replace(SENIORITY_PREFIX, '')]
  return stripped ?? 'generic'
}

export const ROLE_ART_KEYS = Object.keys(ROLE_ART) as RoleArtKey[]

type Props = {
  slug?: string | null
  /** Force a specific illustration (used by previews). */
  art?: RoleArtKey
  size?: number
  className?: string
}

/**
 * Decorative clay-style illustration for a role. The card that uses it already
 * names the role in text, so the SVG is hidden from assistive tech.
 */
export function RoleIllustration({ slug, art, size = 88, className }: Props) {
  // useId gives ":r1:"-style ids; keep them valid inside url(#...).
  const prefix = `ra${useId().replace(/[^a-zA-Z0-9]/g, '')}-`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {drawRoleArt(art ?? resolveRoleArt(slug), prefix)}
    </svg>
  )
}
