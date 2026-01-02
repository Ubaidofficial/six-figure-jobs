
import { format as __format } from 'node:util'
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function main() {
    const slugs = ['personio-test', 'teamtailor-test', 'figma-test']

    for (const slug of slugs) {
        const company = await prisma.company.findUnique({ where: { slug } })
        if (!company || !company.atsProvider || !company.atsUrl) {
            __slog(`Skipping ${slug} - missing metadata`)
            continue
        }

        __slog(`Scraping ${slug} (${company.atsProvider})...`)
        const jobs = await scrapeCompanyAtsJobs(company.atsProvider as any, company.atsUrl)
        __slog(`  Found ${jobs.length} jobs`)
        if (jobs.length > 0) {
            __slog('  Sample job:', jobs[0].title, jobs[0].url)
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
