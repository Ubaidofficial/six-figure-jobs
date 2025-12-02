// app/api/scrape/route.ts

import { NextResponse } from 'next/server'

// ------------------------------------------
// Board scrapers (existing – default exports)
// ------------------------------------------

import scrapeRemoteOK from '../../../lib/scrapers/remoteok'
import scrapeWeWorkRemotely from '../../../lib/scrapers/weworkremotely'
import scrapeNodesk from '../../../lib/scrapers/nodesk'
import scrapeRemoteAI from '../../../lib/scrapers/remoteai'
import scrapeRemotive from '../../../lib/scrapers/remotive'
import scrapeBuiltIn from '../../../lib/scrapers/builtin'
import scrapeRemote100k from '../../../lib/scrapers/remote100k'
import scrapeRemoteRocketship from '../../../lib/scrapers/remoterocketship'

// ------------------------------------------
// NEW board scrapers (named exports)
// ------------------------------------------

import { scrapeRealWorkFromAnywhere } from '../../../lib/scrapers/realworkfromanywhere'
import { scrapeJustJoin } from '../../../lib/scrapers/justjoin'
import { scrapeRemoteOtter } from '../../../lib/scrapers/remoteotter'
import { scrapeTrawle } from '../../../lib/scrapers/trawle'
import { scrapeFourDayWeek } from '../../../lib/scrapers/fourdayweek'
import scrapeYCombinator from '../../../lib/scrapers/ycombinator'
import scrapeGenericSources from '../../../lib/scrapers/generic'

// ------------------------------------------
// ATS scrapers (default exports)
// ------------------------------------------

import { prisma } from '../../../lib/prisma'
import { scrapeCompanyAtsJobs } from '../../../lib/scrapers/ats'
import { upsertJobsForCompanyFromAts } from '../../../lib/jobs/ingestFromAts'
import type { AtsProvider } from '../../../lib/scrapers/ats/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Target = 'boards' | 'ats' | 'all'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const target = (searchParams.get('target') ?? 'boards') as Target

  const runBoards = target === 'boards' || target === 'all'
  const runATS = target === 'ats' || target === 'all'

  const boardResults: any[] = []
  const atsResults: any[] = []

  if (runBoards) {
    console.log('▶ Scraping BOARD sources…')

    boardResults.push(await scrapeRemoteOK())
    boardResults.push(await scrapeWeWorkRemotely())
    boardResults.push(await scrapeNodesk())
    boardResults.push(await scrapeRemoteAI())
    boardResults.push(await scrapeRemotive())
    boardResults.push(await scrapeBuiltIn())
    boardResults.push(await scrapeRemote100k())
    boardResults.push(await scrapeRemoteRocketship())

    // NEW boards
    boardResults.push(await scrapeRealWorkFromAnywhere())
    boardResults.push(await scrapeJustJoin())
    boardResults.push(await scrapeRemoteOtter())
    boardResults.push(await scrapeTrawle())
    boardResults.push(await scrapeFourDayWeek())
    boardResults.push(await scrapeYCombinator())
    boardResults.push(await scrapeGenericSources())
  }

  if (runATS) {
    console.log('▶ Scraping ATS sources…')

    const companies = await prisma.company.findMany({
      where: {
        atsProvider: { not: null },
        atsUrl: { not: null },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        atsProvider: true,
        atsUrl: true,
      },
    })

    for (const company of companies) {
      try {
        const provider = company.atsProvider as AtsProvider
        const rawJobs = await scrapeCompanyAtsJobs(
          provider,
          company.atsUrl as string,
        )
        const result = await upsertJobsForCompanyFromAts(
          company,
          rawJobs,
        )
        atsResults.push({
          company: company.slug,
          provider,
          ...result,
        })
      } catch (err: any) {
        console.error(
          `[ATS] ${company.slug} (${company.atsProvider}) failed`,
          err?.message || err,
        )
        atsResults.push({
          company: company.slug,
          provider: company.atsProvider,
          error: err?.message || 'Unknown ATS error',
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    target,
    boards: boardResults,
    ats: atsResults,
  })
}
