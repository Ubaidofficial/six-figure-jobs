import scrapeRemoteOK from './remoteok'
import scrapeWeWorkRemotely from './weworkremotely'
import scrapeNodesk from './nodesk'
import scrapeBuiltIn from './builtin'
import scrapeRemoteRocketship from './remoterocketship'
import scrapeRemoteAI from './remoteai'
import scrapeRemoteYeah from './remoteyeah'
import scrapeHimalayas from './himalayas'
import scrapeRemoteLeaf from './remoteleaf'
import { discoverRemote100kCompanies } from './remote100k-companies'
import { scrapeRealWorkFromAnywhere } from './realworkfromanywhere'
import { scrapeJustJoin } from './justjoin'
import { scrapeRemoteOtter } from './remoteotter'
import { scrapeTrawle } from './trawle'
import { scrapeFourDayWeek } from './fourdayweek'
import { scrapeH1bVisaJobs, scrapeMyVisaJobs } from './h1bVisaScraper'
import scrapeCursorDirectory from './cursordirectory'
import scrapeRemotive from './remotive'
import scrapeGenericSources from './generic'

export type BoardScraperTask = {
  key: string
  name: string
  run: () => Promise<unknown>
  dryRunSafe?: boolean
  probeUrl?: string
  probeMode?: 'dynamic'
}

export const BOARD_SCRAPERS: BoardScraperTask[] = [
  { key: 'remoteok', name: 'RemoteOK', run: scrapeRemoteOK, probeUrl: 'https://remoteok.com' },
  { key: 'weworkremotely', name: 'WeWorkRemotely', run: scrapeWeWorkRemotely, probeUrl: 'https://weworkremotely.com/remote-100k-or-more-salary-jobs' },
  { key: 'nodesk', name: 'NoDesk', run: scrapeNodesk, probeUrl: 'https://nodesk.co/remote-jobs' },
  { key: 'builtin', name: 'BuiltIn', run: scrapeBuiltIn, probeUrl: 'https://builtin.com/jobs/remote' },
  { key: 'remote100k-companies', name: 'Remote100k-Companies', run: discoverRemote100kCompanies, probeUrl: 'https://remote100k.com' },
  { key: 'remoterocketship', name: 'RemoteRocketship', run: scrapeRemoteRocketship, probeUrl: 'https://www.remoterocketship.com' },
  { key: 'himalayas', name: 'Himalayas', run: scrapeHimalayas, probeUrl: 'https://himalayas.app/jobs' },
  { key: 'remoteleaf', name: 'RemoteLeaf', run: scrapeRemoteLeaf, probeUrl: 'https://remoteleaf.com/jobs' },
  { key: 'realworkfromanywhere', name: 'RealWorkFromAnywhere', run: scrapeRealWorkFromAnywhere, probeUrl: 'https://www.realworkfromanywhere.com/jobs' },
  { key: 'justjoin', name: 'JustJoin', run: scrapeJustJoin, probeUrl: 'https://justjoin.it' },
  { key: 'remoteotter', name: 'RemoteOtter', run: scrapeRemoteOtter, probeUrl: 'https://remoteotter.com' },
  { key: 'trawle', name: 'Trawle', run: scrapeTrawle, probeUrl: 'https://trawle.io' },
  { key: 'fourdayweek', name: 'FourDayWeek', run: scrapeFourDayWeek, probeUrl: 'https://4dayweek.io' },
  { key: 'cursordirectory', name: 'CursorDirectory', run: scrapeCursorDirectory, probeUrl: 'https://www.cursor.com/directory/jobs' },
  { key: 'remotive', name: 'Remotive', run: scrapeRemotive, probeUrl: 'https://remotive.com/remote-jobs' },
  // Retired 2026-06-12: Dice/Wellfound/Otta return 404 (APIs changed / Otta shut
  // down) and YCombinator fetch fails — dead sources burning runtime + inflating
  // the failure count. Scraper files kept in case the sources return.
  { key: 'company-careers', name: 'CompanyCareers', run: scrapeGenericSources, probeMode: 'dynamic' },
  { key: 'remoteyeah', name: 'RemoteYeah', run: scrapeRemoteYeah, dryRunSafe: false, probeUrl: 'https://remoteyeah.com' },
  { key: 'remoteai', name: 'RemoteAI (companies only)', run: scrapeRemoteAI, dryRunSafe: false, probeUrl: 'https://remoteai.io' },
  { key: 'h1bvisajobs', name: 'H1BVisaJobs', run: scrapeH1bVisaJobs, probeUrl: 'https://h1bvisajobs.com' },
  { key: 'myvisajobs', name: 'MyVisaJobs', run: scrapeMyVisaJobs, probeUrl: 'https://www.myvisajobs.com' },
] satisfies BoardScraperTask[]

export const FAST_BOARD_SCRAPER_KEYS = new Set<string>([
  'remoteok',
  'weworkremotely',
  'remote100k-companies',
  'remoterocketship',
  'himalayas',
  'remoteleaf',
  'realworkfromanywhere',
  'justjoin',
  'fourdayweek',
  'company-careers',
  'remoteyeah',
  'remoteai',
])
