import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/&/g, '-and-')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Interface allows optional ATS for companies we need to discover later
interface CompanySeed {
  name: string
  ats?: string
  website?: string
}

const COMPANIES: CompanySeed[] = [
  // ===========================================================================
  // 1. TOP TIER TECH & AI (Existing + Expanded)
  // ===========================================================================
  { name: 'OpenAI', ats: 'https://boards.greenhouse.io/openai' },
  { name: 'Anthropic', ats: 'https://boards.greenhouse.io/anthropic' },
  { name: 'Cohere', ats: 'https://jobs.lever.co/cohere' },
  { name: 'Hugging Face', ats: 'https://apply.workable.com/huggingface' },
  { name: 'Scale AI', ats: 'https://boards.greenhouse.io/scaleai' },
  { name: 'Midjourney', ats: 'https://boards.greenhouse.io/midjourney' },
  { name: 'Perplexity', ats: 'https://boards.greenhouse.io/perplexity' },
  { name: 'Mistral AI', ats: 'https://jobs.lever.co/mistral' },
  { name: 'Runway', ats: 'https://boards.greenhouse.io/runwayml' },
  { name: 'Stability AI', ats: 'https://jobs.lever.co/stability' },
  { name: 'Character AI', ats: 'https://boards.greenhouse.io/character' },
  { name: 'Jasper', ats: 'https://boards.greenhouse.io/jasper' },
  { name: 'Copy.ai', ats: 'https://jobs.ashbyhq.com/copy.ai' },
  { name: 'Writer', ats: 'https://boards.greenhouse.io/writer' },
  { name: 'Together AI', ats: 'https://boards.greenhouse.io/togetherai' },
  { name: 'Anyscale', ats: 'https://boards.greenhouse.io/anyscale' },
  { name: 'Modal', ats: 'https://boards.greenhouse.io/modal' },
  { name: 'Pinecone', ats: 'https://boards.greenhouse.io/pinecone' },
  { name: 'Weaviate', ats: 'https://boards.greenhouse.io/weaviate' },
  { name: 'LangChain', ats: 'https://boards.greenhouse.io/langchain' },
  { name: 'Deepgram', ats: 'https://boards.greenhouse.io/deepgram' },
  { name: 'AssemblyAI', ats: 'https://boards.greenhouse.io/assemblyai' },
  { name: 'Eleven Labs', ats: 'https://jobs.lever.co/elevenlabs' },
  { name: 'Synthesia', ats: 'https://jobs.lever.co/synthesia' },
  { name: 'Descript', ats: 'https://boards.greenhouse.io/descript' },
  { name: 'Cursor', ats: 'https://boards.ashbyhq.com/cursor' },
  { name: 'Superhuman', ats: 'https://jobs.lever.co/superhuman' },

  // ===========================================================================
  // 2. REMOTE-FIRST GIANTS (The "OG" Remote List)
  // ===========================================================================
  { name: 'Automattic', ats: 'https://boards.greenhouse.io/automattic' }, // WordPress
  { name: 'GitLab', ats: 'https://boards.greenhouse.io/gitlab' },
  { name: 'Doist', ats: 'https://boards.greenhouse.io/doist' }, // Todoist
  { name: 'Canonical', ats: 'https://boards.greenhouse.io/canonical' }, // Ubuntu
  { name: 'Zapier', ats: 'https://boards.greenhouse.io/zapier' },
  { name: 'Buffer', website: 'https://buffer.com' },
  { name: 'Ghost', website: 'https://ghost.org' },
  { name: 'Basecamp', website: 'https://basecamp.com' }, // 37signals
  { name: 'DuckDuckGo', ats: 'https://boards.greenhouse.io/duckduckgo' },
  { name: 'Hotjar', ats: 'https://boards.greenhouse.io/hotjar' },
  { name: 'InVision', ats: 'https://boards.greenhouse.io/invision' },
  { name: 'Mural', ats: 'https://boards.greenhouse.io/mural' },
  { name: 'Toptal', ats: 'https://boards.greenhouse.io/toptal' },
  { name: 'Sourcegraph', ats: 'https://boards.greenhouse.io/sourcegraph' },
  { name: 'Hopin', ats: 'https://boards.greenhouse.io/hopin' },
  { name: 'Remote', ats: 'https://boards.greenhouse.io/remotecom' },
  { name: 'Oyster', ats: 'https://boards.greenhouse.io/oyster' },
  { name: 'Deel', ats: 'https://boards.greenhouse.io/deel' },
  { name: 'Toggl', website: 'https://toggl.com' },
  { name: 'Close', ats: 'https://jobs.lever.co/close.io' },
  { name: 'Articulate', ats: 'https://articulate.com/about/careers' },
  { name: 'Elastic', ats: 'https://boards.greenhouse.io/elastic' },
  { name: 'Grafana Labs', ats: 'https://boards.greenhouse.io/grafanalabs' },
  { name: 'HashiCorp', ats: 'https://boards.greenhouse.io/hashicorp' },
  { name: '10up', website: 'https://10up.com' },
  { name: 'Clevertech', website: 'https://clevertech.biz' },
  { name: 'X-Team', website: 'https://x-team.com' },
  { name: 'Modus Create', website: 'https://moduscreate.com' },
  { name: 'CrowdStrike', ats: 'https://boards.greenhouse.io/crowdstrike' },
  { name: 'Okta', ats: 'https://boards.greenhouse.io/okta' },
  { name: 'Auth0', ats: 'https://boards.greenhouse.io/auth0' },
  { name: '1Password', ats: 'https://boards.greenhouse.io/1password' },
  { name: 'Bitwarden', ats: 'https://boards.greenhouse.io/bitwarden' },
  { name: 'Brave', ats: 'https://boards.greenhouse.io/brave' },
  { name: 'Mozilla', ats: 'https://boards.greenhouse.io/mozilla' },
  { name: 'Red Hat', website: 'https://redhat.com' },
  { name: 'SUSE', website: 'https://suse.com' },
  { name: 'Wikimedia Foundation', ats: 'https://boards.greenhouse.io/wikimedia' },
  
  // ===========================================================================
  // 3. EUROPEAN TECH (From Nodesk/EuroRemote Lists)
  // ===========================================================================
  { name: 'Spotify', ats: 'https://jobs.lever.co/spotify' },
  { name: 'Klarna', ats: 'https://boards.greenhouse.io/klarna' },
  { name: 'Revolut', ats: 'https://boards.greenhouse.io/revolut' },
  { name: 'Wise', ats: 'https://boards.greenhouse.io/wise' }, // TransferWise
  { name: 'N26', ats: 'https://boards.greenhouse.io/n26' },
  { name: 'Monzo', ats: 'https://boards.greenhouse.io/monzo' },
  { name: 'Starling Bank', website: 'https://starlingbank.com' },
  { name: 'Adyen', ats: 'https://boards.greenhouse.io/adyen' },
  { name: 'Bolt', website: 'https://bolt.eu' }, 
  { name: 'Wolt', website: 'https://wolt.com' },
  { name: 'Vinted', website: 'https://vinted.com' },
  { name: 'Booking.com', website: 'https://booking.com' },
  { name: 'Personio', website: 'https://personio.com' },
  { name: 'Celonis', website: 'https://celonis.com' },
  { name: 'Contentful', ats: 'https://boards.greenhouse.io/contentful' },
  { name: 'MessageBird', ats: 'https://boards.greenhouse.io/messagebird' }, // Bird
  { name: 'Miro', ats: 'https://boards.greenhouse.io/miro' },
  { name: 'Typeform', ats: 'https://boards.greenhouse.io/typeform' },
  { name: 'Pipedrive', ats: 'https://boards.greenhouse.io/pipedrive' },
  { name: 'Trivago', website: 'https://trivago.com' },
  { name: 'Zalando', website: 'https://zalando.com' },
  { name: 'HelloFresh', website: 'https://hellofresh.com' },
  { name: 'Delivery Hero', website: 'https://deliveryhero.com' },
  { name: 'GetYourGuide', ats: 'https://boards.greenhouse.io/getyourguide' },
  { name: 'BlaBlaCar', website: 'https://blablacar.com' },
  { name: 'Doctolib', website: 'https://doctolib.fr' },
  { name: 'Alan', ats: 'https://boards.greenhouse.io/alan' },
  { name: 'Qonto', website: 'https://qonto.com' },
  { name: 'Back Market', website: 'https://backmarket.com' },
  { name: 'Ledger', ats: 'https://jobs.lever.co/ledger' },
  { name: 'Sorare', ats: 'https://boards.greenhouse.io/sorare' },
  { name: 'Pleo', ats: 'https://boards.greenhouse.io/pleo' },
  { name: 'Peak', website: 'https://peak.ai' },
  { name: 'Onfido', ats: 'https://boards.greenhouse.io/onfido' },
  { name: 'Checkout.com', ats: 'https://boards.greenhouse.io/checkoutcom' },
  { name: 'Gocardless', ats: 'https://boards.greenhouse.io/gocardless' },
  { name: 'Trade Republic', ats: 'https://boards.greenhouse.io/traderepublic' },
  { name: 'Bitpanda', ats: 'https://boards.greenhouse.io/bitpanda' },
  { name: 'SumUp', ats: 'https://boards.greenhouse.io/sumup' },
  { name: 'Mambu', ats: 'https://boards.greenhouse.io/mambu' },
  { name: 'Algolia', ats: 'https://boards.greenhouse.io/algolia' }, // FR roots
  { name: 'Dataiku', ats: 'https://boards.greenhouse.io/dataiku' },
  { name: 'Aircall', ats: 'https://boards.greenhouse.io/aircall' },
  { name: 'Spendesk', ats: 'https://jobs.lever.co/spendesk' },
  { name: 'Payfit', ats: 'https://boards.greenhouse.io/payfit' },
  { name: 'Swile', ats: 'https://jobs.lever.co/swile' },
  { name: 'Malt', ats: 'https://jobs.lever.co/malt' },
  { name: 'JobTeaser', ats: 'https://jobs.lever.co/jobteaser' },
  { name: 'Yousign', ats: 'https://jobs.lever.co/yousign' },
  { name: 'DeepL', website: 'https://deepl.com' },
  { name: 'Personio', website: 'https://personio.com' },
  { name: 'Taxfix', ats: 'https://boards.greenhouse.io/taxfix' },
  { name: 'Tier Mobility', ats: 'https://boards.greenhouse.io/tiermobility' },
  { name: 'Flink', ats: 'https://boards.greenhouse.io/flink' },
  { name: 'Gorillas', ats: 'https://boards.greenhouse.io/gorillas' },
  
  // ===========================================================================
  // 4. US FINTECH & SAAS (Expanded)
  // ===========================================================================
  { name: 'Stripe', ats: 'https://boards.greenhouse.io/stripe' },
  { name: 'Coinbase', ats: 'https://boards.greenhouse.io/coinbase' },
  { name: 'Plaid', ats: 'https://boards.greenhouse.io/plaid' },
  { name: 'Brex', ats: 'https://boards.greenhouse.io/brex' },
  { name: 'Ramp', ats: 'https://boards.greenhouse.io/ramp' },
  { name: 'Mercury', ats: 'https://boards.greenhouse.io/mercury' },
  { name: 'Robinhood', ats: 'https://boards.greenhouse.io/robinhood' },
  { name: 'Affirm', ats: 'https://boards.greenhouse.io/affirm' },
  { name: 'Chime', ats: 'https://boards.greenhouse.io/chime' },
  { name: 'Marqeta', ats: 'https://boards.greenhouse.io/marqeta' },
  { name: 'Bill.com', ats: 'https://boards.greenhouse.io/billcom' },
  { name: 'Navan', ats: 'https://boards.greenhouse.io/navan' }, // TripActions
  { name: 'Carta', ats: 'https://boards.greenhouse.io/carta' },
  { name: 'Gusto', ats: 'https://boards.greenhouse.io/gusto' },
  { name: 'Rippling', ats: 'https://boards.greenhouse.io/rippling' },
  { name: 'Zenefits', ats: 'https://boards.greenhouse.io/zenefits' },
  { name: 'BambooHR', ats: 'https://boards.greenhouse.io/bamboohr' },
  { name: 'Justworks', ats: 'https://boards.greenhouse.io/justworks' },
  { name: 'Lattice', ats: 'https://boards.greenhouse.io/lattice' },
  { name: 'Culture Amp', ats: 'https://boards.greenhouse.io/cultureamp' },
  { name: 'Lever', ats: 'https://jobs.lever.co/lever' },
  { name: 'Greenhouse', ats: 'https://boards.greenhouse.io/greenhouse' },
  { name: 'Ashby', ats: 'https://boards.greenhouse.io/ashby' },
  { name: 'Workable', ats: 'https://apply.workable.com/workable' },
  { name: 'Gem', ats: 'https://boards.greenhouse.io/gem' },
  { name: 'Checkr', ats: 'https://boards.greenhouse.io/checkr' },
  { name: 'Faire', ats: 'https://boards.greenhouse.io/faire' },
  { name: 'Flexport', ats: 'https://boards.greenhouse.io/flexport' },
  { name: 'Samsara', ats: 'https://boards.greenhouse.io/samsara' },
  { name: 'Motive', ats: 'https://boards.greenhouse.io/motive' }, // KeepTruckin
  { name: 'Convoy', ats: 'https://boards.greenhouse.io/convoy' },
  { name: 'Uber Freight', ats: 'https://boards.greenhouse.io/uberfreight' },
  
  // ===========================================================================
  // 5. DEVELOPER TOOLS & INFRASTRUCTURE
  // ===========================================================================
  { name: 'GitHub', ats: 'https://boards.greenhouse.io/github' },
  { name: 'Vercel', ats: 'https://boards.greenhouse.io/vercel' },
  { name: 'Supabase', ats: 'https://boards.greenhouse.io/supabase' },
  { name: 'PlanetScale', ats: 'https://boards.greenhouse.io/planetscale' },
  { name: 'Neon', ats: 'https://boards.greenhouse.io/neondatabase' },
  { name: 'Railway', ats: 'https://boards.greenhouse.io/railway' },
  { name: 'Render', ats: 'https://boards.greenhouse.io/render' },
  { name: 'Fly.io', ats: 'https://boards.greenhouse.io/flyio' },
  { name: 'Cloudflare', ats: 'https://boards.greenhouse.io/cloudflare' },
  { name: 'Fastly', ats: 'https://boards.greenhouse.io/fastly' },
  { name: 'Docker', ats: 'https://boards.greenhouse.io/docker' },
  { name: 'Postman', ats: 'https://boards.greenhouse.io/postman' },
  { name: 'Snyk', ats: 'https://boards.greenhouse.io/snyk' },
  { name: 'Datadog', ats: 'https://boards.greenhouse.io/datadog' },
  { name: 'New Relic', ats: 'https://boards.greenhouse.io/newrelic' },
  { name: 'Dynatrace', website: 'https://dynatrace.com' },
  { name: 'Splunk', ats: 'https://boards.greenhouse.io/splunk' },
  { name: 'PagerDuty', ats: 'https://boards.greenhouse.io/pagerduty' },
  { name: 'Pulumi', ats: 'https://boards.greenhouse.io/pulumi' },
  { name: 'Tailscale', ats: 'https://boards.greenhouse.io/tailscale' },
  { name: 'Kong', ats: 'https://boards.greenhouse.io/kong' },
  { name: 'Prisma', ats: 'https://boards.greenhouse.io/prisma' },
  { name: 'Apollo GraphQL', ats: 'https://boards.greenhouse.io/apollographql' },
  { name: 'Linear', ats: 'https://boards.greenhouse.io/linear' },
  { name: 'Retool', ats: 'https://boards.greenhouse.io/retool' },
  { name: 'MongoDB', ats: 'https://boards.greenhouse.io/mongodb' },
  { name: 'Couchbase', ats: 'https://boards.greenhouse.io/couchbase' },
  { name: 'Redis', ats: 'https://boards.greenhouse.io/redis' },
  { name: 'InfluxData', ats: 'https://boards.greenhouse.io/influxdata' },
  { name: 'Timescale', ats: 'https://boards.greenhouse.io/timescale' },
  { name: 'Cockroach Labs', ats: 'https://boards.greenhouse.io/cockroachlabs' },
  { name: 'CircleCI', ats: 'https://boards.greenhouse.io/circleci' },
  { name: 'LaunchDarkly', ats: 'https://boards.greenhouse.io/launchdarkly' },
  { name: 'Travis CI', website: 'https://travis-ci.com' },
  { name: 'Harness', ats: 'https://boards.greenhouse.io/harness' },
  
  // ===========================================================================
  // 6. MODERN STARTUPS & HIGH GROWTH
  // ===========================================================================
  { name: 'Resend', ats: 'https://jobs.ashbyhq.com/resend' },
  { name: 'Raycast', ats: 'https://jobs.ashbyhq.com/raycast' },
  { name: 'Clerk', ats: 'https://jobs.ashbyhq.com/clerk' },
  { name: 'Astral', ats: 'https://jobs.ashbyhq.com/astral' },
  { name: 'Paradigm', ats: 'https://jobs.ashbyhq.com/paradigm' },
  { name: 'Palantir', ats: 'https://jobs.lever.co/palantir' },
  { name: 'Figma', ats: 'https://boards.greenhouse.io/figma' },
  { name: 'Canva', ats: 'https://boards.greenhouse.io/canva' },
  { name: 'Loom', ats: 'https://boards.greenhouse.io/loom' },
  { name: 'Notion', ats: 'https://boards.greenhouse.io/notion' },
  { name: 'Coda', ats: 'https://boards.greenhouse.io/coda' },
  { name: 'Airtable', ats: 'https://boards.greenhouse.io/airtable' },
  { name: 'Webflow', ats: 'https://boards.greenhouse.io/webflow' },
  { name: 'Framer', ats: 'https://boards.greenhouse.io/framer' },
  { name: 'Substack', ats: 'https://boards.greenhouse.io/substack' },
  { name: 'Patreon', ats: 'https://boards.greenhouse.io/patreon' },
  { name: 'Gumroad', ats: 'https://gumroad.com/jobs' },
  { name: 'Teachable', ats: 'https://boards.greenhouse.io/teachable' },
  { name: 'Thinkific', ats: 'https://boards.greenhouse.io/thinkific' },
  { name: 'Podia', ats: 'https://boards.greenhouse.io/podia' },
  { name: 'Kajabi', ats: 'https://boards.greenhouse.io/kajabi' },
  { name: 'Circle', ats: 'https://boards.greenhouse.io/circle' }, // Community platform
  { name: 'Discord', ats: 'https://boards.greenhouse.io/discord' },
  { name: 'Twitch', ats: 'https://boards.greenhouse.io/twitch' },
  { name: 'Reddit', ats: 'https://boards.greenhouse.io/reddit' },
  { name: 'Pinterest', ats: 'https://boards.greenhouse.io/pinterest' },
  { name: 'Snap', ats: 'https://boards.greenhouse.io/snap' },
  { name: 'Duolingo', ats: 'https://boards.greenhouse.io/duolingo' },
  
  // ===========================================================================
  // 7. CONSUMER & MARKETPLACE
  // ===========================================================================
  { name: 'Airbnb', ats: 'https://boards.greenhouse.io/airbnb' },
  { name: 'Uber', ats: 'https://boards.greenhouse.io/uber' },
  { name: 'Lyft', ats: 'https://jobs.lever.co/lyft' },
  { name: 'DoorDash', ats: 'https://boards.greenhouse.io/doordash' },
  { name: 'Instacart', ats: 'https://boards.greenhouse.io/instacart' },
  { name: 'Netflix', ats: 'https://jobs.lever.co/netflix' },
  { name: 'Hims & Hers', ats: 'https://boards.greenhouse.io/himshers' },
  { name: 'Ro', ats: 'https://boards.greenhouse.io/ro' },
  { name: 'Thirty Madison', ats: 'https://boards.greenhouse.io/thirtymadison' },
  { name: 'Maven Clinic', ats: 'https://boards.greenhouse.io/mavenclinic' },
  { name: 'Omada Health', ats: 'https://boards.greenhouse.io/omadahealth' },
  { name: 'Calm', ats: 'https://boards.greenhouse.io/calm' },
  { name: 'Headspace', ats: 'https://boards.greenhouse.io/headspace' },
  { name: 'Strava', ats: 'https://boards.greenhouse.io/strava' },
  { name: 'Peloton', ats: 'https://boards.greenhouse.io/peloton' },
  { name: 'Whoop', ats: 'https://boards.greenhouse.io/whoop' },
  { name: 'Oura', ats: 'https://boards.greenhouse.io/oura' },
  { name: 'Zwift', ats: 'https://boards.greenhouse.io/zwift' },
  
  // ===========================================================================
  // 8. CRYPTO & WEB3
  // ===========================================================================
  { name: 'Coinbase', ats: 'https://boards.greenhouse.io/coinbase' },
  { name: 'Kraken', ats: 'https://boards.greenhouse.io/kraken' },
  { name: 'Gemini', ats: 'https://boards.greenhouse.io/gemini' },
  { name: 'Binance', ats: 'https://boards.greenhouse.io/binance' },
  { name: 'ConsenSys', ats: 'https://boards.greenhouse.io/consensys' },
  { name: 'Chainlink', ats: 'https://boards.greenhouse.io/chainlink' },
  { name: 'Anchorage Digital', ats: 'https://boards.greenhouse.io/anchoragedigital' },
  { name: 'Fireblocks', ats: 'https://boards.greenhouse.io/fireblocks' },
  { name: 'OpenSea', ats: 'https://boards.greenhouse.io/opensea' },
  { name: 'Uniswap', ats: 'https://boards.greenhouse.io/uniswap' },
  { name: 'Alchemy', ats: 'https://boards.greenhouse.io/alchemy' },
  { name: 'Phantom', ats: 'https://boards.greenhouse.io/phantom' },
  { name: 'Solana Labs', ats: 'https://boards.greenhouse.io/solanalabs' },
  { name: 'Ava Labs', ats: 'https://boards.greenhouse.io/avalabs' },
  { name: 'Polygon', ats: 'https://boards.greenhouse.io/polygon' },
  { name: 'Ripple', ats: 'https://boards.greenhouse.io/ripple' },
  { name: 'Stellar', ats: 'https://boards.greenhouse.io/stellar' },
  { name: 'Circle', ats: 'https://boards.greenhouse.io/circle' },
  { name: 'Block', ats: 'https://boards.greenhouse.io/block' }, // Square
  
  // ===========================================================================
  // 9. EDTECH & LEARNING
  // ===========================================================================
  { name: 'Coursera', ats: 'https://boards.greenhouse.io/coursera' },
  { name: 'Udemy', ats: 'https://boards.greenhouse.io/udemy' },
  { name: 'Udacity', ats: 'https://boards.greenhouse.io/udacity' },
  { name: 'MasterClass', ats: 'https://boards.greenhouse.io/masterclass' },
  { name: 'Khan Academy', ats: 'https://boards.greenhouse.io/khanacademy' },
  { name: 'Quizlet', ats: 'https://boards.greenhouse.io/quizlet' },
  { name: 'Codecademy', ats: 'https://boards.greenhouse.io/codecademy' },
  { name: 'Skillshare', ats: 'https://boards.greenhouse.io/skillshare' },
  { name: 'ClassDojo', ats: 'https://boards.greenhouse.io/classdojo' },
  { name: 'Outschool', ats: 'https://boards.greenhouse.io/outschool' },
  { name: 'Guild Education', ats: 'https://boards.greenhouse.io/guildeducation' },
  
  // ===========================================================================
  // 10. SPACE & HARDWARE
  // ===========================================================================
  { name: 'SpaceX', ats: 'https://boards.greenhouse.io/spacex' },
  { name: 'Anduril', ats: 'https://boards.greenhouse.io/anduril' },
  { name: 'Relativity Space', ats: 'https://boards.greenhouse.io/relativityspace' },
  { name: 'Planet', ats: 'https://boards.greenhouse.io/planet' },
  { name: 'Rocket Lab', ats: 'https://boards.greenhouse.io/rocketlab' },
  { name: 'Varda', ats: 'https://boards.greenhouse.io/varda' },
  { name: 'Astranis', ats: 'https://jobs.lever.co/astranis' },
  { name: 'Boom Supersonic', ats: 'https://boards.greenhouse.io/boomsupersonic' },
  { name: 'Joby Aviation', ats: 'https://boards.greenhouse.io/jobyaviation' },
  { name: 'Archer', ats: 'https://boards.greenhouse.io/archer' },
]

async function main() {
  console.log(`🚀 Seeding ${COMPANIES.length} companies...`)
  let added = 0
  let skipped = 0

  for (const c of COMPANIES) {
    const slug = slugify(c.name)
    
    // Check if exists
    const existing = await prisma.company.findFirst({ 
      where: { OR: [{ slug }, { name: c.name }] } 
    })

    if (existing) {
      // Update missing ATS URL if we have one now
      if (c.ats && !existing.atsUrl) {
        await prisma.company.update({
          where: { id: existing.id },
          data: { atsUrl: c.ats }
        })
        console.log(`  Updated ATS for: ${c.name}`)
      } else {
        skipped++
      }
      continue
    }

    // Determine ATS provider if possible
    let provider: string | null = null
    let atsSlug: string | null = null
    
    if (c.ats) {
      if (c.ats.includes('greenhouse')) {
        provider = 'greenhouse'
        atsSlug = c.ats.split('/').pop() || ''
      } else if (c.ats.includes('lever')) {
        provider = 'lever'
        atsSlug = c.ats.split('/').pop() || ''
      } else if (c.ats.includes('ashby')) {
        provider = 'ashby'
        atsSlug = c.ats.split('/').pop() || ''
      }
    }

    // Best guess website
    const website = c.website || `https://${slug}.com`

    await prisma.company.create({
      data: {
        name: c.name,
        slug,
        atsUrl: c.ats || null,
        atsProvider: provider,
        atsSlug: atsSlug,
        website: website,
        logoUrl: `https://logo.clearbit.com/${slug.replace(/-/g, '')}.com`,
      }
    })
    console.log(`  + Added: ${c.name}`)
    added++
  }

  console.log(`\n✅ Done! Added ${added} new companies. Skipped ${skipped} existing.`)
  console.log(`📊 Total companies in DB: ${await prisma.company.count()}`)
  
  await prisma.$disconnect()
}

main().catch(console.error)