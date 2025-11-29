
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import { prisma } from '../lib/prisma'

async function main() {
    const slugs = ['personio-test', 'teamtailor-test', 'figma-test']

    for (const slug of slugs) {
        const company = await prisma.company.findUnique({ where: { slug } })
        if (!company || !company.atsProvider || !company.atsUrl) {
            console.log(`Skipping ${slug} - missing metadata`)
            continue
        }

        console.log(`Scraping ${slug} (${company.atsProvider})...`)
        const jobs = await scrapeCompanyAtsJobs(company.atsProvider as any, company.atsUrl)
        console.log(`  Found ${jobs.length} jobs`)
        if (jobs.length > 0) {
            console.log('  Sample job:', jobs[0].title, jobs[0].url)
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
