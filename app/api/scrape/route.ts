// app/api/scrape/route.ts

import { NextResponse } from 'next/server'

// ------------------------------------------
// Board scrapers (existing – default exports)
// ------------------------------------------

import scrapeRemoteOK from '../../../lib/scrapers/remoteok'
import scrapeWeWorkRemotely from '../../../lib/scrapers/weworkremotely'
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

// ------------------------------------------
// ATS scrapers (default exports)
// ------------------------------------------

import scrapeGreenhouse from '../../../lib/scrapers/greenhouse'
// TODO: add Ashby / Lever / Workday scrapers here when ready

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
  }

  if (runATS) {
    console.log('▶ Scraping ATS sources…')

    atsResults.push(await scrapeGreenhouse())
    // add Ashby / Lever / Workday here when you have them
  }

  return NextResponse.json({
    ok: true,
    target,
    boards: boardResults,
    ats: atsResults,
  })
}
