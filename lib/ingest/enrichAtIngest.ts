// lib/ingest/enrichAtIngest.ts
//
// Free, deterministic enrichment done while a job is ingested, so every scraped job is saved already enriched: no model
// call, no network, no cost, whatever the day's free-LLM allowance is. (The LLM rewrite is a separate, budgeted step; see
// lib/ai/enrichSelection.ts.)
//
//  - tech stack and skills, from the title and description, when the source gave no skills of its own;
//  - `remoteMode`: "remote", from a sentence the posting really says (lib/jobs/remoteEvidence.ts), only when the field is
//    empty, per the owner's ruling in CLAUDE.md. Hybrid/on-site readings are not applied here (they change JSON-LD
//    `jobLocation`); scripts/backfillRemoteEvidence.ts can apply them deliberately.
//
// Deliberately NOT done here: visa sponsorship (a keyword match cannot tell "we sponsor" from "we do not sponsor"), and
// the languages a posting requires (no column to hold them; see scripts/audit-language-requirements.ts).
import { extractTechStackFromText } from '../tech/extractTechStack'
import { findRemoteEvidence } from '../jobs/remoteEvidence'

export type IngestEnrichment = {
  /** JSON array of display names, as scripts/backfill-tech-stack.ts stores it. */
  techStack?: string
  /** JSON array of slugs; only when the source supplied no skills. */
  skillsJson?: string
  remoteMode?: 'remote'
}

export function enrichAtIngest(job: {
  title: string | null | undefined
  descriptionHtml: string | null | undefined
  sourceHasSkills: boolean
  /** The job's remoteMode as already decided (location data, an ATS, or what is stored). */
  remoteMode: string | null | undefined
  /** The job's remote flag as already decided. */
  isRemote: boolean | null | undefined
}): IngestEnrichment {
  const out: IngestEnrichment = {}
  const description = job.descriptionHtml ?? ''
  if (description) {
    const tech = extractTechStackFromText(`${job.title ?? ''}\n${description}`)
    if (tech.display.length) {
      out.techStack = JSON.stringify(tech.display)
      if (!job.sourceHasSkills) out.skillsJson = JSON.stringify(tech.slugs)
    }
    if (!job.remoteMode && !job.isRemote && findRemoteEvidence(description)?.mode === 'remote') out.remoteMode = 'remote'
  }
  return out
}
