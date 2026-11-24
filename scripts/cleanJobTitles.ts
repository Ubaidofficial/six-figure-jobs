// scripts/cleanJobTitles.ts
//
// Cleans the titles of jobs already stored (lib/jobs/cleanTitle.ts: "---" chains, the job's own city, pay typed into
// the title); new freehire jobs are cleaned as they are imported. A dry run unless --apply is passed: it prints how many
// live jobs would change and examples. With --apply it writes the title and the dedupe key built from it together, and
// skips a job whose cleaned key another job of the same company already holds. The job's page address follows the
// title; the old address redirects (app/job/[slug]/page.tsx). SEO change: see CHANGELOG.
//
//   npx tsx scripts/cleanJobTitles.ts            # dry run
//   npx tsx scripts/cleanJobTitles.ts --apply
import { makeJobDedupeKey } from '../lib/ingest/dedupeHelpers'
import { cleanJobTitle } from '../lib/jobs/cleanTitle'
import { prisma } from '../lib/prisma'

const apply = process.argv.includes('--apply')

async function main() {
  // Only titles that can change: "---", a "$" amount, or a number followed by k (the cleaner decides on each).
  const rows = await prisma.$queryRaw<Array<{ id: string; title: string; companyId: string | null; locationRaw: string | null }>>`
    SELECT id, title, "companyId", "locationRaw" FROM "Job"
    WHERE "isExpired" = false AND (title LIKE '%---%' OR title ~ '\\$\\s?[0-9]' OR title ~* '[0-9]{2,3}\\s?k\\y')
    LIMIT 50000`
  const changes = rows
    .map((r) => ({ ...r, cleaned: cleanJobTitle(r.title, { location: r.locationRaw }) }))
    .filter((r) => r.cleaned !== r.title)

  console.log(`${rows.length} live jobs checked, ${changes.length} titles to clean ${apply ? '' : '(dry run: nothing written)'}`)
  // Every change, so the dry run can be read in full before --apply.
  for (const c of changes) console.log(`  ${c.title}\n    -> ${c.cleaned}`)

  if (!apply) return
  let written = 0
  let clashes = 0
  for (const c of changes) {
    const dedupeKey = c.companyId ? makeJobDedupeKey(c.companyId, c.cleaned, c.locationRaw) : null
    if (dedupeKey) {
      const taken = await prisma.job.findFirst({ where: { companyId: c.companyId, dedupeKey, id: { not: c.id } }, select: { id: true } })
      if (taken) {
        clashes++
        continue
      }
    }
    await prisma.job.update({ where: { id: c.id }, data: { title: c.cleaned, ...(dedupeKey ? { dedupeKey } : {}) } })
    written++
  }
  console.log(`written ${written}, skipped ${clashes} whose cleaned title another job of the same company already has`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
