// scripts/auditSkillCoverage.ts
//
// READ-ONLY. Which skills do the live jobs carry, and which of them have no skill page or filter? The skill pages are the
// SKILL_TARGETS list (lib/seo/pseoTargets.ts); a skill many live jobs name but that is not on it is a gap. Also compared with the
// ten skill pages a competitor (himalayas.app/jobs, read 2026-11-17) links: Salesforce, Java, PHP, SQL, Shopify, NodeJS,
// JavaScript, Kubernetes, Python, WordPress. SELECTs only, inside a READ ONLY transaction. Output: counts and skill names (no
// personal data).
//
//   npx tsx scripts/auditSkillCoverage.ts
import { appendFileSync } from 'node:fs'

import { SKILL_TARGETS, skillStoredTokens } from '../lib/seo/pseoTargets'

/** The skill names in a stored JSON array (skillsJson or techStack), lowercased; [] when it is empty or not valid (pure). */
export function skillTokens(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().toLowerCase()).filter(Boolean) : []
  } catch {
    return []
  }
}

/** The skill-page slugs whose stored spellings include this token (pure). */
export function coveredBy(token: string): string[] {
  return SKILL_TARGETS.filter((t) => skillStoredTokens(t.slug).includes(token)).map((t) => t.slug)
}

const COMPETITOR_SKILLS = ['salesforce', 'java', 'php', 'sql', 'shopify', 'nodejs', 'javascript', 'kubernetes', 'python', 'wordpress']

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const out: string[] = ['## Skills on live jobs against the skill pages (read-only)', '']
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        const jobs = await tx.job.findMany({ where: { isExpired: false }, select: { skillsJson: true, techStack: true }, take: 60000 })
        const counts = new Map<string, number>()
        // What a skill page counts: its filter reads skillsJson only (queryJobs: skillsJson contains "token"), not techStack.
        const onPage = new Map<string, number>()
        let withSkills = 0
        let withTech = 0
        let withEither = 0
        for (const j of jobs) {
          const s = skillTokens(j.skillsJson)
          const t = skillTokens(j.techStack)
          if (s.length) withSkills++
          if (t.length) withTech++
          if (s.length || t.length) withEither++
          for (const tok of new Set([...s, ...t])) counts.set(tok, (counts.get(tok) ?? 0) + 1)
          for (const tok of new Set(s)) onPage.set(tok, (onPage.get(tok) ?? 0) + 1)
        }
        const pct = (n: number) => `${((n / Math.max(jobs.length, 1)) * 100).toFixed(1)}%`
        out.push(`${jobs.length} live jobs. With skillsJson: ${withSkills} (${pct(withSkills)}). With techStack: ${withTech} (${pct(withTech)}). With either: ${withEither} (${pct(withEither)}). Distinct skill names: ${counts.size}.`, '')
        out.push(`Skill pages today: ${SKILL_TARGETS.length} (${SKILL_TARGETS.map((s) => s.slug).join(', ')}).`, '')
        const ranked = [...counts].sort((a, b) => b[1] - a[1])
        out.push('### Most common skills, and whether a skill page covers them', '', '| skill | live jobs (skills or tech stack) | live jobs a skill page would list (skills only) | skill page |', '| --- | --- | --- | --- |')
        for (const [tok, n] of ranked.slice(0, 70)) out.push(`| ${tok} | ${n} | ${onPage.get(tok) ?? 0} | ${coveredBy(tok).join(', ') || '**none**'} |`)
        out.push('', '### Skills a competitor links (himalayas.app), here', '', '| skill | live jobs here | skill page |', '| --- | --- | --- |')
        for (const tok of COMPETITOR_SKILLS) out.push(`| ${tok} | ${counts.get(tok) ?? 0} | ${coveredBy(tok).join(', ') || '**none**'} |`)
        const gaps = ranked.filter(([tok]) => coveredBy(tok).length === 0).slice(0, 40)
        out.push('', '### Top skills with no page', '', gaps.map(([tok, n]) => `${tok} (${n})`).join(', ') || '(none)')
      },
      { timeout: 120_000, maxWait: 30_000 },
    )
  } finally {
    await prisma.$disconnect()
  }
  const text = out.join('\n')
  console.log(text)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
