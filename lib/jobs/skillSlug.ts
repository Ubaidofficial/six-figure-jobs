// lib/jobs/skillSlug.ts
//
// Which of our skill hub pages (/jobs/skills/<slug>) a skill name belongs to, or null when there is no hub for it.
// Lives in lib/ (not in the client JobCard) so server pages can link skills the same way the cards do.
import { SKILL_TARGETS } from '@/lib/seo/pseoTargets'

function normalizeSkillKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const SKILL_KEY_TO_SLUG = new Map<string, string>()
for (const target of SKILL_TARGETS) {
  SKILL_KEY_TO_SLUG.set(normalizeSkillKey(target.slug), target.slug)
  SKILL_KEY_TO_SLUG.set(normalizeSkillKey(target.label), target.slug)
}

const SKILL_ALIASES: Record<string, string> = {
  c: 'c-plus-plus',
  cpp: 'c-plus-plus',
  node: 'node-js',
  nodejs: 'node-js',
  next: 'nextjs',
  postgres: 'postgresql',
  ml: 'machine-learning',
  machinelearning: 'machine-learning',
  go: 'golang',
}

export function resolveSkillSlug(value: string): string | null {
  const key = normalizeSkillKey(value.trim())
  if (!key) return null
  const alias = SKILL_ALIASES[key]
  if (alias) return alias
  return SKILL_KEY_TO_SLUG.get(key) ?? null
}
