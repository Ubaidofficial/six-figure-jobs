// scripts/sampleDescriptionEnrich.ts
// #13 SAMPLE — runs the existing AI enricher on a few live jobs and PRINTS the
// bulleted output. No DB writes. Lets us judge quality before batching.

import { prisma } from '../lib/prisma'
import { enrichJobWithAI } from '../lib/ai/openaiEnricher'

function strip(html: string | null | undefined): string {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const jobs = await prisma.job.findMany({
    where: { isExpired: false, descriptionHtml: { not: null } },
    select: { id: true, title: true, company: true, descriptionHtml: true, locationRaw: true },
    orderBy: { updatedAt: 'desc' },
    take: 4,
  })

  for (const job of jobs) {
    const roleSnippet = strip(job.descriptionHtml).slice(0, 6000)
    try {
      const { out } = await enrichJobWithAI({
        title: job.title || '',
        roleSnippet,
        locationHint: job.locationRaw || undefined,
        maxOutputTokens: 1500,
      })
      console.log(`\n======== ${job.title} @ ${job.company} ========`)
      console.log(`raw description: ${roleSnippet.length} chars of unstructured text`)
      console.log(`\noneLiner: ${out.oneLiner}`)
      console.log(`snippet:  ${out.snippet}`)
      console.log('\nWHAT YOU WILL DO:')
      ;(out.description || []).forEach((b: string) => console.log('  •', b))
      console.log('REQUIREMENTS:')
      ;(out.requirements || []).forEach((b: string) => console.log('  •', b))
      console.log('BENEFITS:')
      ;(out.benefits || []).forEach((b: string) => console.log('  •', b))
    } catch (e: any) {
      console.log(`\n[sample] FAILED for ${job.title}: ${e?.message || e}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
