// scripts/seed.ts

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

// ---------------------------------------------------------------------------
// CORE CURATED COMPANIES (WITH ATS/CAREER URLS)
// ---------------------------------------------------------------------------

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
  { name: 'Automattic', ats: 'https://boards.greenhouse.io/automattic' },
  { name: 'GitLab', ats: 'https://boards.greenhouse.io/gitlab' },
  { name: 'Doist', ats: 'https://boards.greenhouse.io/doist' },
  { name: 'Canonical', ats: 'https://boards.greenhouse.io/canonical' },
  { name: 'Zapier', ats: 'https://boards.greenhouse.io/zapier' },
  { name: 'Buffer', website: 'https://buffer.com' },
  { name: 'Ghost', website: 'https://ghost.org' },
  { name: 'Basecamp', website: 'https://basecamp.com' },
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
  // 3. EUROPEAN TECH
  // ===========================================================================
  { name: 'Spotify', ats: 'https://jobs.lever.co/spotify' },
  { name: 'Klarna', ats: 'https://boards.greenhouse.io/klarna' },
  { name: 'Revolut', ats: 'https://boards.greenhouse.io/revolut' },
  { name: 'Wise', ats: 'https://boards.greenhouse.io/wise' },
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
  { name: 'MessageBird', ats: 'https://boards.greenhouse.io/messagebird' },
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
  { name: 'Algolia', ats: 'https://boards.greenhouse.io/algolia' },
  { name: 'Dataiku', ats: 'https://boards.greenhouse.io/dataiku' },
  { name: 'Aircall', ats: 'https://boards.greenhouse.io/aircall' },
  { name: 'Spendesk', ats: 'https://jobs.lever.co/spendesk' },
  { name: 'Payfit', ats: 'https://boards.greenhouse.io/payfit' },
  { name: 'Swile', ats: 'https://jobs.lever.co/swile' },
  { name: 'Malt', ats: 'https://jobs.lever.co/malt' },
  { name: 'JobTeaser', ats: 'https://jobs.lever.co/jobteaser' },
  { name: 'Yousign', ats: 'https://jobs.lever.co/yousign' },
  { name: 'DeepL', website: 'https://deepl.com' },
  { name: 'Taxfix', ats: 'https://boards.greenhouse.io/taxfix' },
  { name: 'Tier Mobility', ats: 'https://boards.greenhouse.io/tiermobility' },
  { name: 'Flink', ats: 'https://boards.greenhouse.io/flink' },
  { name: 'Gorillas', ats: 'https://boards.greenhouse.io/gorillas' },

  // ===========================================================================
  // 4. US FINTECH & SAAS
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
  { name: 'Navan', ats: 'https://boards.greenhouse.io/navan' },
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
  { name: 'Motive', ats: 'https://boards.greenhouse.io/motive' },
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
  { name: 'Circle', ats: 'https://boards.greenhouse.io/circle' },
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
  { name: 'Block', ats: 'https://boards.greenhouse.io/block' },

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

  // ===========================================================================
  // 11. EXTRA REMOTE-FIRST / REMOTE-FRIENDLY COMPANIES
  // ===========================================================================
  { name: 'Help Scout' },
  { name: 'Abstract' },
  { name: 'Aha!' },
  { name: 'Baremetrics' },
  { name: 'ConvertKit' },
  { name: 'Customer.io' },
  { name: 'Harvest' },
  { name: 'Heap' },
  { name: 'Lumen5' },
  { name: 'MailerLite' },
  { name: 'ScrapingBee' },
  { name: 'Shogun' },
  { name: 'Toggl Track' },
  { name: 'Toggl Plan' },
  { name: 'Time Doctor' },
  { name: 'GitBook' },
  { name: 'Feather' },
  { name: 'Formstack' },
  { name: 'Glitch' },
  { name: 'HelpCrunch' },
  { name: 'Kinsta' },
  { name: 'Knack' },
  { name: 'Mighty Networks' },
  { name: 'Pilot' },
  { name: 'Remote Year' },
  { name: 'Vidyard' },
  { name: 'AirGarage' },
  { name: 'Crossover' },
  { name: 'Lokalise' },
  { name: 'Float' },
  { name: 'Zapier Labs' },
  { name: 'InVisionApp' },
  { name: 'Close CRM' },
  { name: 'GitPrime' },
  { name: 'Dozr' },
  { name: 'We Work Remotely' },
  { name: 'Remotive' },
  { name: 'Himalayas' },
  { name: 'Remote OK' },
  { name: 'Remote In Tech' },
  { name: 'AngelList Talent' },
  { name: 'Flexa Careers' },
  { name: 'Levels.fyi' },
  { name: 'Proxify' },
  { name: 'Turing' },
  { name: 'Crossover for Work' },
  { name: 'Andela' },
  { name: 'Xero' },
  { name: 'Basecamp Software' },
  { name: 'Abstract API' },
  { name: 'Remote Rocketship' },
  { name: 'Remote 100K' },

  // ===========================================================================
  // 11. BIG TECH & ENTERPRISE (NEW)
  // ===========================================================================
  { name: 'Google', website: 'https://careers.google.com' },
  { name: 'Apple', website: 'https://jobs.apple.com' },
  { name: 'Meta', website: 'https://www.metacareers.com' },
  { name: 'Microsoft', website: 'https://careers.microsoft.com' },
  { name: 'Amazon', website: 'https://www.amazon.jobs' },
  { name: 'Salesforce', ats: 'https://salesforce.wd1.myworkdayjobs.com/en-US/ExternalCareerSite' },
  { name: 'Adobe', website: 'https://adobe.com/careers' },
  { name: 'SAP', website: 'https://jobs.sap.com' },
  { name: 'Oracle', website: 'https://careers.oracle.com' },
  { name: 'IBM', website: 'https://www.ibm.com/careers' },
  { name: 'NVIDIA', website: 'https://nvidia.com/en-us/about-nvidia/careers' },
  { name: 'AMD', website: 'https://www.amd.com/en/corporate/careers' },
  { name: 'Intel', website: 'https://jobs.intel.com' },
  { name: 'Cisco', website: 'https://jobs.cisco.com' },
  { name: 'HP', website: 'https://jobs.hp.com' },
  { name: 'Dell Technologies', website: 'https://jobs.dell.com' },
  { name: 'ServiceNow', website: 'https://careers.servicenow.com' },
  { name: 'Snowflake', website: 'https://careers.snowflake.com' },
  { name: 'Atlassian', website: 'https://www.atlassian.com/company/careers' },
  { name: 'Shopify', website: 'https://www.shopify.com/careers' },
  { name: 'Square', website: 'https://squareup.com/careers' },
  { name: 'Blockstream', website: 'https://blockstream.com/careers' },
  { name: 'Workday', website: 'https://workday.wd5.myworkdayjobs.com/en-US/Workday' },
  { name: 'Slack', website: 'https://slack.com/careers' },
  { name: 'Zoom', website: 'https://zoom.us/careers' },
  { name: 'Dropbox', website: 'https://dropbox.com/jobs' },
  { name: 'Box', website: 'https://careers.box.com' },
  { name: 'HubSpot', website: 'https://www.hubspot.com/careers' },
  { name: 'Zendesk', website: 'https://jobs.zendesk.com' },

  // ===========================================================================
  // 12. CYBERSECURITY & DEVSECOPS (NEW)
  // ===========================================================================
  { name: 'Palo Alto Networks', website: 'https://jobs.paloaltonetworks.com' },
  { name: 'Zscaler', website: 'https://www.zscaler.com/careers' },
  { name: 'Fortinet', website: 'https://www.fortinet.com/corporate/about-us/careers' },
  { name: 'SentinelOne', website: 'https://www.sentinelone.com/careers' },
  { name: 'CyberArk', website: 'https://www.cyberark.com/careers' },
  { name: 'Tenable', website: 'https://careers.tenable.com' },
  { name: 'Rapid7', website: 'https://www.rapid7.com/careers' },
  { name: 'CrowdStrike Services', website: 'https://www.crowdstrike.com/careers' },
  { name: 'Darktrace', website: 'https://www.darktrace.com/en/careers' },
  { name: 'Check Point Software', website: 'https://www.checkpoint.com/about-us/careers' },

  // ===========================================================================
  // 13. DATA, ANALYTICS & ML PLATFORMS (NEW)
  // ===========================================================================
  { name: 'Databricks', website: 'https://databricks.com/company/careers' },
  { name: 'Cloudera', website: 'https://cloudera.com/careers' },
  { name: 'Fivetran', website: 'https://fivetran.com/careers' },
  { name: 'dbt Labs', website: 'https://www.getdbt.com/careers' },
  { name: 'Looker', website: 'https://looker.com/careers' },
  { name: 'Tableau', website: 'https://www.tableau.com/about/careers' },
  { name: 'Amplitude', website: 'https://amplitude.com/careers' },
  { name: 'Mixpanel', website: 'https://mixpanel.com/careers' },
  { name: 'Segment', website: 'https://segment.com/careers' },
  { name: 'Snowplow', website: 'https://snowplowanalytics.com/company/careers' },
  { name: 'SAS', website: 'https://www.sas.com/en_us/careers.html' },
  { name: 'Alteryx', website: 'https://www.alteryx.com/careers' },

  // ===========================================================================
  // 14. PRODUCTIVITY, PROJECT & COLLABORATION TOOLS (NEW)
  // ===========================================================================
  { name: 'Asana', ats: 'https://boards.greenhouse.io/asana' },
  { name: 'Monday.com', website: 'https://monday.com/careers' },
  { name: 'Smartsheet', website: 'https://www.smartsheet.com/careers' },
  { name: 'ClickUp', website: 'https://clickup.com/careers' },
  { name: 'Calendly', website: 'https://careers.calendly.com' },
  { name: 'Evernote', website: 'https://evernote.com/careers' },
  { name: 'Notion Labs', website: 'https://www.notion.so/careers' },
  { name: 'Trello', website: 'https://trello.com/jobs' },
  { name: 'Basecamp HQ', website: 'https://basecamp.com/about/jobs' },
  { name: 'LinearB', website: 'https://linearb.io/careers' },
  { name: 'Mavenlink', website: 'https://mavenlink.com/careers' },
  { name: 'Lucid Software', website: 'https://www.lucid.co/careers' },

  // ===========================================================================
  // 15. HEALTHCARE, BIO & DIGITAL HEALTH (NEW)
  // ===========================================================================
  { name: 'Flatiron Health', website: 'https://flatiron.com/careers' },
  { name: 'Tempus Labs', website: 'https://www.tempus.com/careers' },
  { name: 'Verily', website: 'https://verily.com/careers' },
  { name: '23andMe', website: 'https://www.23andme.com/careers' },
  { name: 'Lyra Health', website: 'https://www.lyrahealth.com/careers' },
  { name: 'Headway', website: 'https://headway.co/careers' },
  { name: 'Cityblock Health', website: 'https://cityblock.com/careers' },
  { name: 'Roivant Sciences', website: 'https://www.roivant.com/careers' },
  { name: 'Babylon Health', website: 'https://www.babylonhealth.com/careers' },
  { name: 'Zocdoc', website: 'https://www.zocdoc.com/about/careers' },
  { name: 'Teladoc Health', website: 'https://www.teladochealth.com/careers' },

  // ===========================================================================
  // 16. GAMING, MEDIA & ENTERTAINMENT (NEW)
  // ===========================================================================
  { name: 'Riot Games', website: 'https://www.riotgames.com/en/work-with-us' },
  { name: 'Blizzard Entertainment', website: 'https://careers.blizzard.com' },
  { name: 'Activision', website: 'https://careers.activision.com' },
  { name: 'Electronic Arts', website: 'https://www.ea.com/careers' },
  { name: 'Ubisoft', website: 'https://www.ubisoft.com/en-us/company/careers' },
  { name: 'Epic Games', website: 'https://www.epicgames.com/site/en-US/careers' },
  { name: 'Roblox', website: 'https://careers.roblox.com' },
  { name: 'Unity Technologies', website: 'https://careers.unity.com' },
  { name: 'Valve', website: 'https://www.valvesoftware.com/en/jobs' },
  { name: 'Supercell', website: 'https://supercell.com/en/careers' },
  { name: 'Niantic', website: 'https://nianticlabs.com/jobs' },
  { name: 'PlayStation', website: 'https://www.playstation.com/en-us/corporate/careers' },
  { name: 'Nintendo of America', website: 'https://careers.nintendo.com' },
  { name: 'HBO Max / Warner Bros. Discovery', website: 'https://careers.wbd.com' },

  // ===========================================================================
  // 17. LARGE CONSULTING, CLOUD & SYSTEM INTEGRATORS (NEW)
  // ===========================================================================
  { name: 'Accenture', website: 'https://www.accenture.com/careers' },
  { name: 'Deloitte Digital', website: 'https://www2.deloitte.com/global/en/careers' },
  { name: 'PwC', website: 'https://www.pwc.com/careers' },
  { name: 'KPMG', website: 'https://home.kpmg/xx/en/home/careers.html' },
  { name: 'EY', website: 'https://www.ey.com/en_gl/careers' },
  { name: 'Capgemini', website: 'https://www.capgemini.com/careers' },
  { name: 'Cognizant', website: 'https://www.cognizant.com/careers' },
  { name: 'Infosys', website: 'https://www.infosys.com/careers' },
  { name: 'TCS', website: 'https://www.tcs.com/careers' },
  { name: 'Wipro', website: 'https://careers.wipro.com' },
  { name: 'HCLTech', website: 'https://www.hcltech.com/careers' },
  { name: 'NTT Data', website: 'https://careers-inc.nttdata.com' },

  // ===========================================================================
  // 18. MORE MODERN SAAS & DEVTOOLS (NEW)
  // ===========================================================================
  { name: 'Sentry', website: 'https://sentry.io/careers' },
  { name: 'Posthog', website: 'https://posthog.com/careers' },
  { name: 'Launchpad Lab', website: 'https://www.launchpadlab.com/careers' },
  { name: 'Airbyte', website: 'https://airbyte.com/company/careers' },
  { name: 'RudderStack', website: 'https://rudderstack.com/careers' },
  { name: 'Temporal', website: 'https://temporal.io/careers' },
  { name: 'Convex', website: 'https://convex.dev/careers' },
  { name: 'Turso', website: 'https://turso.tech/careers' },
  { name: 'PlanetScale Partners', website: 'https://planetscale.com/careers' },
  { name: 'Clerk Dev', website: 'https://clerk.com/careers' },
  { name: 'Inngest', website: 'https://www.inngest.com/careers' },
  { name: 'Nitro', website: 'https://gonitro.com/careers' },

  // ===========================================================================
  // 19. E-COMMERCE & MARKETPLACE (NEW)
  // ===========================================================================
  { name: 'Shopify Plus', website: 'https://www.shopify.com/careers' },
  { name: 'Etsy', website: 'https://www.etsy.com/careers' },
  { name: 'Wayfair', website: 'https://www.aboutwayfair.com/careers' },
  { name: 'Chewy', website: 'https://careers.chewy.com' },
  { name: 'Zillow', website: 'https://www.zillowgroup.com/careers' },
  { name: 'Opendoor', website: 'https://www.opendoor.com/w/careers' },
  { name: 'OfferUp', website: 'https://about.offerup.com/careers' },
  { name: 'Instapage', website: 'https://instapage.com/careers' },
  { name: 'Eventbrite', website: 'https://www.eventbritecareers.com' },
  { name: 'Yelp', website: 'https://www.yelp.careers' },
  { name: 'Grubhub', website: 'https://careers.grubhub.com' },
  { name: 'Deliveroo', website: 'https://careers.deliveroo.co.uk' },

  // ===========================================================================
  // 20. MISC HIGH-GROWTH & REMOTE-FRIENDLY COMPANIES (NEW)
  // ===========================================================================
  { name: 'RemoteOK', website: 'https://remoteok.com' },
  { name: 'WeWorkRemotely', website: 'https://weworkremotely.com' },
  { name: 'Remotive', website: 'https://remotive.com' },
  { name: 'AngelList Talent', website: 'https://angel.co/careers' },
  { name: 'HackerRank', website: 'https://www.hackerrank.com/careers' },
  { name: 'HackerOne', website: 'https://www.hackerone.com/careers' },
  { name: 'Dribbble', website: 'https://dribbble.com/careers' },
  { name: 'Behance', website: 'https://www.behance.net/careers' },
  { name: 'InVisionApp', website: 'https://www.invisionapp.com/careers' },
  { name: 'Linear.app', website: 'https://linear.app/careers' },
  { name: 'Loom Inc', website: 'https://www.loom.com/careers' },
  { name: 'SuperRare', website: 'https://superrare.com/careers' },
  { name: 'FigJam', website: 'https://www.figma.com/careers' },
  { name: 'Vanta', website: 'https://www.vanta.com/careers' },
  { name: 'Persona', website: 'https://withpersona.com/careers' },
  { name: 'Canopy', website: 'https://www.canopy.com/careers' },
  { name: 'TrueLayer', website: 'https://truelayer.com/careers' },
  { name: 'OnDeck', website: 'https://www.beondeck.com/careers' },
  { name: 'Levels Health', website: 'https://www.levelshealth.com/careers' },
  { name: 'Eight Sleep', website: 'https://www.eightsleep.com/careers' },
]

// ---------------------------------------------------------------------------
// DISCOVERY CANDIDATES (NAME-ONLY, MASSIVE LIST)
// These will still get slugs, guessed websites, and be deduped against above.
// ---------------------------------------------------------------------------

const DISCOVERY_COMPANIES: CompanySeed[] = [
  { name: '1 Second Everyday' }, { name: '10up' }, { name: '15Five' }, { name: '350' }, 
  { name: '37signals' }, { name: '6sense' }, { name: '8x8' }, { name: 'Ably' }, { name: 'Abstract' }, 
  { name: 'Acquia' }, { name: 'ActiveCampaign' }, { name: 'Ad Hoc' }, { name: 'AgencyAnalytics' }, 
  { name: 'Agorapulse' }, { name: 'Aha!' }, { name: 'Ahrefs' }, { name: 'Aiir' }, { name: 'Airbase' }, 
  { name: 'Airtame' }, { name: 'All Turtles' }, { name: 'Alloy' }, { name: 'AllTrails' }, { name: 'AlphaSights' }, 
  { name: 'Altruistiq' }, { name: 'Anagram' }, { name: 'Animalz' }, { name: 'Apollo' }, { name: 'Aptible' }, 
  { name: 'Archilogic' }, { name: 'Argyle' }, { name: 'Armor Games' }, { name: 'Artificial' }, 
  { name: 'Astronomer' }, { name: 'Astropad' }, { name: 'Avea' }, { name: 'Avo' }, { name: 'Awesome Motive' }, 
  { name: 'Axios' }, { name: 'B12' }, { name: 'balena' }, { name: 'Ballotpedia' }, { name: 'Bandcamp' }, 
  { name: 'Bandzoogle' }, { name: 'Baremetrics' }, { name: 'Battlefy' }, { name: 'Baymard Institute' }, 
  { name: 'Bearer' }, { name: 'Bejamas' }, { name: 'Bench' }, { name: 'Bettermode' }, { name: 'BetterUp' }, 
  { name: 'Beutler Ink' }, { name: 'Bevy' }, { name: 'Beyond Meat' }, { name: 'Big Cartel' }, { name: 'Bird' }, 
  { name: 'Biteable' }, { name: 'Bleacher Report' }, { name: 'Blexr' }, { name: 'Bluecode' }, { name: 'Boulevard' }, 
  { name: 'Boundless' }, { name: 'Brandwatch' }, { name: 'Bravely' }, { name: 'Brightrock Games' }, 
  { name: 'BriteCore' }, { name: 'Bugcrowd' }, { name: 'BuildZoom' }, { name: 'Business Insider' }, 
  { name: 'Bustle' }, { name: 'BuySellAds' }, { name: 'Callingly' }, { name: 'Cameo' }, { name: 'Campaign Monitor' }, 
  { name: 'Canny' }, { name: 'Capsule' }, { name: 'CareMessage' }, { name: 'Carrot' }, { name: 'Castos' }, 
  { name: 'Catalpa' }, { name: 'CB Insights' }, { name: 'ChartMogul' }, { name: 'Chess.com' }, { name: 'Chili Piper' }, 
  { name: 'Circle' }, { name: 'CivicActions' }, { name: 'Claap' }, { name: 'ClassDojo' }, { name: 'Clearbit' }, 
  { name: 'Clerky' }, { name: 'CloudBees' }, { name: 'Cloudlinux' }, { name: 'Codacy' }, { name: 'Code for America' }, 
  { name: 'Code.org' }, { name: 'CodeCombat' }, { name: 'CodeNewbie' }, { name: 'Cofense' }, 
  { name: 'Coffee Meets Bagel' }, { name: 'Coherent' }, { name: 'Collabora' }, { name: 'CommentSold' }, 
  { name: 'Conductor' }, { name: 'Continu' }, { name: 'Contra' }, { name: 'Convert' }, { name: 'CopyPress' }, 
  { name: 'Cortico' }, { name: 'Countly' }, { name: 'Coursedog' }, { name: 'CrateDB' }, { name: 'Crazy Games' }, 
  { name: 'Creative Commons' }, { name: 'Creative Market' }, { name: 'CreatorIQ' }, { name: 'Credible' }, 
  { name: 'Crescent' }, { name: 'Cro Metrics' }, { name: 'Crossover' }, { name: 'Cryptocurrency Jobs' }, 
  { name: 'Culdesac' }, { name: 'Curology' }, { name: 'Customer.io' }, { name: 'CVEDIA' }, { name: 'Cycloid' }, 
  { name: 'Cypress' }, { name: 'D2iQ' }, { name: 'Daily.co' }, { name: 'Dark Matter Labs' }, { name: 'Dataquest' }, 
  { name: 'DataStax' }, { name: 'DeepSource' }, { name: 'Delighted' }, { name: 'Designlab' }, { name: 'DEV' }, 
  { name: 'Differential' }, { name: 'Digication' }, { name: 'Digital Science' }, { name: 'DigitalOcean' }, 
  { name: 'Discourse' }, { name: 'DNSFilter' }, { name: 'DNSimple' }, { name: 'DockYard' }, { name: 'AngelList' }, 
  { name: 'BairesDev' }, { name: 'BandLab' }, { name: 'Cloudbeds' }, { name: 'Codelathe' }, { name: 'ConsenSys' }, 
  { name: 'DataRobot' }, { name: 'Dribbble' }, { name: 'End Point Dev' }, { name: 'Envato' }, { name: 'Eyeo' }, 
  { name: 'Fireflies.ai' }, { name: 'Gatsby' }, { name: 'Genuitec' }, { name: 'Gradle' }, { name: 'Igalia' }, 
  { name: 'Jackson River' }, { name: 'Jitbit' }, { name: 'Kentik' }, { name: 'Kraken' }, { name: 'Lullabot' }, 
  { name: 'madewithlove' }, { name: 'MailerLite' }, { name: 'MarsBased' }, { name: 'Mobile Jazz' }, { name: 'Netlify' }, 
  { name: 'Olark' }, { name: 'Original Eight' }, { name: 'Percona' }, { name: 'Platform.sh' }, { name: 'Pythian' }, 
  { name: 'Redox' }, { name: 'SaasGroup' }, { name: 'ScyllaDB' }, { name: 'Sonatype' }, { name: 'Superside' }, 
  { name: 'Time Doctor' }, { name: 'Turing' }, { name: 'Upwork' }, { name: 'Xapo' }, { name: 'XWP' }, 
  { name: 'You Need A Budget' }, { name: 'Zyte' }, { name: 'Kinsta' }, { name: 'Kissmetrics' }, { name: 'Knapsack' }, 
  { name: 'Knewton' }, { name: 'Knolee' }, { name: 'Koding' }, { name: 'Komoot' }, { name: 'Konnektid' }, 
  { name: 'Kustomer' }, { name: 'Later' }, { name: 'LaunchBoom' }, { name: 'Lawn Love' }, { name: 'Lawyerist' }, 
  { name: 'Leadfeeder' }, { name: 'Legalist' }, { name: 'Lemon.io' }, { name: 'Lets Encrypt' }, { name: 'Level 12' }, 
  { name: 'Lightstream' }, { name: 'Linden Lab' }, { name: 'Lingo Live' }, { name: 'Linktree' }, { name: 'Lionbridge' }, 
  { name: 'Litmus' }, { name: 'Littledata' }, { name: 'LIV' }, { name: 'Livestorm' }, { name: 'Lookback' }, 
  { name: 'MindsDB' }, { name: 'Mode' }, { name: 'Modern Treasury' }, { name: 'Modsquad' }, { name: 'Monetate' }, 
  { name: 'MonetizeMore' }, { name: 'Moodle' }, { name: 'Morning Brew' }, { name: 'Muck Rack' }, { name: 'Museum Hack' }, 
  { name: 'Mysterium Network' }, { name: 'Nacelle' }, { name: 'Namecheap' }, { name: 'NannyML' }, { name: 'Narrative' }, 
  { name: 'NationBuilder' }, { name: 'Nava' }, { name: 'NearForm' }, { name: 'Netguru' }, { name: 'Next Matter' }, 
  { name: 'Nightwatch' }, { name: 'niphtio' }, { name: 'The Mind Company' }, { name: 'The Motley Fool' }, 
  { name: 'The Narwhal' }, { name: 'Third Iron' }, { name: 'This Dot' }, { name: 'Thorn' }, { name: 'ThreatConnect' }, 
  { name: 'Tidepool' }, { name: 'TigerData' }, { name: 'Tighten' }, { name: 'TileDB' }, { name: 'Tinuiti' }, 
  { name: 'Tock' }, { name: 'Trail of Bits' }, { name: 'Travis CI' }, { name: 'Treasure Data' }, { name: 'Treehouse' }, 
  { name: 'Truly' }, { name: 'Truss' }, { name: 'Truveris' }, { name: 'Tuff' }, { name: 'Tuft & Needle' }, 
  { name: 'Tuple' }, { name: 'Turbotax' }, { name: 'Uberall' }, { name: 'UiPath' }, { name: 'Ukufu' }, 
  { name: 'Universe' }, { name: 'Unsplash' }, { name: 'Uplift Advisory' }, { name: 'UpMetrics' }, { name: 'Upper Hand' }, 
  { name: 'User Interviews' }, { name: 'UserTesting' }, { name: 'Ushahidi' }, { name: 'Vaadin' }, { name: 'Verily' }, 
  { name: 'Whitespectre' }, { name: 'Whop' }, { name: 'Wiki Education' }, { name: 'Wild Animal Initiative' }, 
  { name: 'Wirecutter' }, { name: 'WonderProxy' }, { name: 'WorkOS' }, { name: 'WP Media' }, { name: 'Wren' }, 
  { name: 'Wunderdogs' }, { name: 'Xata' }, { name: 'YES! Magazine' }, { name: 'YNAB' }, { name: 'YourTradebase' }, 
  { name: 'Z1' }, { name: 'Zaengle' }, { name: 'Zeal' }, { name: 'Zengenti' }, { name: 'Zenskar' }, { name: 'Zero' }, 
  { name: 'Zima Media' }, { name: 'Zipline' }, { name: 'Zoom' }, { name: 'Auth0' }, { name: 'Betterment' },
  { name: 'Blackboard' }, { name: 'Booking.com' }, { name: 'Brightcove' }, { name: 'Broadcom' }, { name: 'Carbon Black' },
  { name: 'Carbon Five' }, { name: 'Change.org' }, { name: 'Chegg' }, { name: 'Ciena' }, { name: 'Cisco' },
  { name: 'Citrix' }, { name: 'Cloudera' }, { name: 'Cloudinary' }, { name: 'Code42' }, { name: 'Coinbase' },
  { name: 'Collins Aerospace' }, { name: 'Comcast' }, { name: 'Commvault' }, { name: 'Compass' }, { name: 'Confluent' },
  { name: 'ConsenSys' }, { name: 'Contentful' }, { name: 'Convoy' }, { name: 'Couchbase' }, { name: 'Coursera' },
  { name: 'CoverMyMeds' }, { name: 'Credit Karma' }, { name: 'CrowdStrike' }, { name: 'Cruise' }, { name: 'Databricks' },
  { name: 'Datadog' }, { name: 'DataRobot' }, { name: 'DataStax' }, { name: 'Dell' }, { name: 'Deloitte' },
  { name: 'Delta Air Lines' }, { name: 'Dexcom' }, { name: 'DigitalOcean' }, { name: 'Discovery' }, { name: 'Discord' },
  { name: 'Disney' }, { name: 'DocuSign' }, { name: 'Dolby' }, { name: 'DoorDash' }, { name: 'DraftKings' },
  { name: 'Dropbox' }, { name: 'DuckDuckGo' }, { name: 'Duolingo' }, { name: 'Dynatrace' }, { name: 'eBay' },
  { name: 'Elastic' }, { name: 'Electronic Arts' }, { name: 'Epic Games' }, { name: 'Equinix' }, { name: 'Eventbrite' },
  { name: 'Evernote' }, { name: 'Expedia' }, { name: 'Expensify' }, { name: 'F5 Networks' }, { name: 'Facebook' },
  { name: 'Faire' }, { name: 'Fastly' }, { name: 'Fidelity Investments' }, { name: 'Figma' }, { name: 'FireEye' },
  { name: 'Fitbit' }, { name: 'Fiverr' }, { name: 'Flexport' }, { name: 'Flipkart' }, { name: 'Flywire' },
  { name: 'Ford' }, { name: 'Fortinet' }, { name: 'Foursquare' }, { name: 'Fox Corporation' }, { name: 'Framer' },
  { name: 'Front' }, { name: 'Gainsight' }, { name: 'Gap' }, { name: 'Garmin' }, { name: 'Gartner' },
  { name: 'General Electric' }, { name: 'General Motors' }, { name: 'Genesys' }, { name: 'GitHub' }, { name: 'GitLab' },
  { name: 'Glassdoor' }, { name: 'GoDaddy' }, { name: 'Goldman Sachs' }, { name: 'Google' }, { name: 'GoPro' },
  { name: 'Grab' }, { name: 'Grafana' }, { name: 'Grammarly' }, { name: 'Grubhub' }, { name: 'Guidewire' },
  { name: 'Gumroad' }, { name: 'Gusto' }, { name: 'HackerOne' }, { name: 'HashiCorp' }, { name: 'HBO' },
  { name: 'HCL Technologies' }, { name: 'Headspace' }, { name: 'Heap' }, { name: 'HelloFresh' }, { name: 'Help Scout' },
  { name: 'Heroku' }, { name: 'Hewlett Packard Enterprise' }, { name: 'Honey' }, { name: 'Honeywell' }, { name: 'Hootsuite' },
  { name: 'Hopin' }, { name: 'Hotjar' }, { name: 'HP' }, { name: 'HubSpot' }, { name: 'Hulu' },
  { name: 'Humana' }, { name: 'IBM' }, { name: 'iCIMS' }, { name: 'Ideo' }, { name: 'Indeed' },
  { name: 'InVision' }, { name: 'Instacart' }, { name: 'Intel' }, { name: 'Intercom' }, { name: 'Intuit' },
  { name: 'Invitae' }, { name: 'iRobot' }, { name: 'Iron Mountain' }, { name: 'Jamf' }, { name: 'Jane Street' },
  { name: 'JetBlue' }, { name: 'Johnson & Johnson' }, { name: 'JPMorgan Chase' }, { name: 'Juniper Networks' }, { name: 'Justworks' },
  { name: 'Kaiser Permanente' }, { name: 'Kayak' }, { name: 'Khan Academy' }, { name: 'Kickstarter' }, { name: 'Klarna' },
  { name: 'Klaviyo' }, { name: 'KnowBe4' }, { name: 'Kohl\'s' }, { name: 'Konica Minolta' }, { name: 'Kraken' },
  { name: 'Kroger' }, { name: 'Lattice' }, { name: 'LaunchDarkly' }, { name: 'LegalZoom' }, { name: 'LendingClub' },
  { name: 'Lenovo' }, { name: 'Lever' }, { name: 'Levi Strauss' }, { name: 'Liberty Mutual' }, { name: 'Life360' },
  { name: 'Lime' }, { name: 'LinkedIn' }, { name: 'LiveNation' }, { name: 'LiveRamp' }, { name: 'Logitech' },
  { name: 'LogMeIn' }, { name: 'Looker' }, { name: 'Loom' }, { name: 'Lowe\'s' }, { name: 'Lucid' },
  { name: 'Lyft' }, { name: 'Macy\'s' }, { name: 'Magic Leap' }, { name: 'Mailchimp' }, { name: 'Mapbox' },
  { name: 'Marqeta' }, { name: 'Marriott' }, { name: 'Mastercard' }, { name: 'Match Group' }, { name: 'MathWorks' },
  { name: 'Mattermost' }, { name: 'McKinsey' }, { name: 'Medallia' }, { name: 'MediaTek' }, { name: 'Medium' },
  { name: 'Meetup' }, { name: 'Mercari' }, { name: 'Merck' }, { name: 'Meta' }, { name: 'MetLife' },
  { name: 'MGM Resorts' }, { name: 'Micron' }, { name: 'Microsoft' }, { name: 'Mimecast' }, { name: 'Mindbody' },
  { name: 'Minecraft' }, { name: 'Minted' }, { name: 'Miro' }, { name: 'Mixpanel' }, { name: 'MLB' },
  { name: 'Modern Health' }, { name: 'MongoDB' }, { name: 'Monday.com' }, { name: 'MoneyLion' }, { name: 'Mongo' },
  { name: 'Morningstar' }, { name: 'Motorola' }, { name: 'Mozilla' }, { name: 'MuleSoft' }, { name: 'National Instruments' },
  { name: 'NBA' }, { name: 'NBCUniversal' }, { name: 'NCR' }, { name: 'NetApp' }, { name: 'Netflix' },
  { name: 'Netlify' }, { name: 'New Relic' }, { name: 'New York Times' }, { name: 'Nextdoor' }, { name: 'NFL' },
  { name: 'Nike' }, { name: 'Nintendo' }, { name: 'Nissan' }, { name: 'Nokia' }, { name: 'Nordstrom' },
  { name: 'Northrop Grumman' }, { name: 'NortonLifeLock' }, { name: 'Notion' }, { name: 'Novartis' }, { name: 'Nuance' },
  { name: 'Nutanix' }, { name: 'Nvidia' }, { name: 'Okta' }, { name: 'OfferUp' }, { name: 'Office Depot' },
  { name: 'OkCupid' }, { name: 'Old Navy' }, { name: 'Omnicell' }, { name: 'OnDeck' }, { name: 'OneLogin' },
  { name: 'OpenAI' }, { name: 'OpenDoor' }, { name: 'OpenTable' }, { name: 'Optimizely' }, { name: 'Oracle' },
  { name: 'O' + 'Reilly Auto Parts' }, { name: 'Oscar Health' }, { name: 'Outreach' }, { name: 'Overstock' }, { name: 'PagerDuty' },
  { name: 'Palantir' }, { name: 'Palo Alto Networks' }, { name: 'Panasonic' }, { name: 'Pandora' }, { name: 'Paramount' },
  { name: 'Patreon' }, { name: 'Paychex' }, { name: 'Paylocity' }, { name: 'PayPal' }, { name: 'Peloton' },
  { name: 'Pendo' }, { name: 'Pensce' }, { name: 'PepsiCo' }, { name: 'Pfizer' }, { name: 'Philips' },
  { name: 'Pinterest' }, { name: 'Pivotal' }, { name: 'Plaid' }, { name: 'Planet' }, { name: 'PlayStation' },
  { name: 'Plex' }, { name: 'Pluralsight' }, { name: 'Policygenius' }, { name: 'Postmates' }, { name: 'Procore' },
  { name: 'Prologis' }, { name: 'Proofpoint' }, { name: 'Prudential' }, { name: 'PubMatic' }, { name: 'Puppet' },
  { name: 'Pure Storage' }, { name: 'Qualcomm' }, { name: 'Qualtrics' }, { name: 'Quantcast' }, { name: 'Quest Diagnostics' },
  { name: 'Quicken Loans' }, { name: 'Quora' }, { name: 'Rackspace' }, { name: 'Rakuten' }, { name: 'Rally Health' },
  { name: 'Rapid7' }, { name: 'Raytheon' }, { name: 'Realtor.com' }, { name: 'Red Hat' }, { name: 'Red Ventures' },
  { name: 'Reddit' }, { name: 'Redfin' }, { name: 'Redis' }, { name: 'Reebok' }, { name: 'Refinitiv' },
  { name: 'Regions Bank' }, { name: 'REI' }, { name: 'Remitly' }, { name: 'Rent the Runway' }, { name: 'ResearchGate' },
  { name: 'Retool' }, { name: 'Reuters' }, { name: 'Rev' }, { name: 'Revolut' }, { name: 'RingCentral' },
  { name: 'Riot Games' }, { name: 'Ripple' }, { name: 'Rippling' }, { name: 'Rivian' }, { name: 'Robinhood' },
  { name: 'Roblox' }, { name: 'Roche' }, { name: 'Rockstar Games' }, { name: 'Roku' }, { name: 'Rolls-Royce' },
  { name: 'Royal Caribbean' }, { name: 'Rubrik' }, { name: 'Salesforce' }, { name: 'Samsara' }, { name: 'Samsung' },
  { name: 'SAP' }, { name: 'SAS' }, { name: 'Scale AI' }, { name: 'Schlumberger' }, { name: 'Schneider Electric' },
  { name: 'Scribd' }, { name: 'Seagate' }, { name: 'SeatGeek' }, { name: 'Segment' }, { name: 'SendGrid' },
  { name: 'ServiceNow' }, { name: 'Shazam' }, { name: 'Shipt' }, { name: 'Shopify' }, { name: 'Shutterfly' },
  { name: 'Siemens' }, { name: 'Sigma Computing' }, { name: 'Signal' }, { name: 'Silicon Labs' }, { name: 'Silver Lake' },
  { name: 'SimpliSafe' }, { name: 'Skillshare' }, { name: 'Skyscanner' }, { name: 'Slack' }, { name: 'Slalom' },
  { name: 'Sling TV' }, { name: 'SmartThings' }, { name: 'Smartsheet' }, { name: 'Snap' }, { name: 'Snapchat' },
  { name: 'Snowflake' }, { name: 'SoFi' }, { name: 'SolarWinds' }, { name: 'Sonos' }, { name: 'Sony' },
  { name: 'SoundCloud' }, { name: 'SpaceX' }, { name: 'Spectrum' }, { name: 'Splunk' }, { name: 'Spotify' },
  { name: 'Spring Health' }, { name: 'Sprout Social' }, { name: 'Square' }, { name: 'Squarespace' }, { name: 'Stack Overflow' },
  { name: 'Starbucks' }, { name: 'State Farm' }, { name: 'Stitch Fix' }, { name: 'Strava' }, { name: 'Stripe' },
  { name: 'StubHub' }, { name: 'Substack' }, { name: 'Sumo Logic' }, { name: 'Sunrun' }, { name: 'SurveyMonkey' },
  { name: 'Sweetgreen' }, { name: 'Symantec' }, { name: 'Synopsys' }, { name: 'Sysco' }, { name: 'Tableau' },
  { name: 'Taco Bell' }, { name: 'Talend' }, { name: 'Target' }, { name: 'TaskRabbit' }, { name: 'Tanium' },
  { name: 'TD Bank' }, { name: 'Teachable' }, { name: 'TeamViewer' }, { name: 'TechCrunch' }, { name: 'Teladoc' },
  { name: 'Tencent' }, { name: 'Tesla' }, { name: 'Texas Instruments' }, { name: 'TextNow' }, { name: 'The Trade Desk' },
  { name: 'The Washington Post' }, { name: 'Thermo Fisher' }, { name: 'ThoughtSpot' }, { name: 'ThoughtWorks' }, { name: 'Thumbtack' },
  { name: 'Ticketmaster' }, { name: 'TikTok' }, { name: 'Tile' }, { name: 'Tinder' }, { name: 'T-Mobile' },
  { name: 'Toast' }, { name: 'Toggl' }, { name: 'Topgolf' }, { name: 'Toptal' }, { name: 'Toyota' },
  { name: 'Trader Joe\'s' }, { name: 'Trello' }, { name: 'Trend Micro' }, { name: 'TripAdvisor' }, { name: 'Triplebyte' },
  { name: 'Truist' }, { name: 'Trulia' }, { name: 'Trusted Health' }, { name: 'Twilio' }, { name: 'Twitch' },
  { name: 'Twitter' }, { name: 'Two Sigma' }, { name: 'Turo' }, { name: 'Typeform' }, { name: 'Uber' },
  { name: 'Ubisoft' }, { name: 'Udacity' }, { name: 'Udemy' }, { name: 'UiPath' }, { name: 'UKG' },
  { name: 'Ulta Beauty' }, { name: 'Under Armour' }, { name: 'Uniqlo' }, { name: 'United Airlines' }, { name: 'UnitedHealth Group' },
  { name: 'Unity' }, { name: 'Universal Music Group' }, { name: 'Upstart' }, { name: 'Upwork' }, { name: 'US Bank' },
  { name: 'USAA' }, { name: 'UserTesting' }, { name: 'Vacasa' }, { name: 'Vail Resorts' }, { name: 'Valve' },
  { name: 'Vanguard' }, { name: 'Veeva' }, { name: 'Venmo' }, { name: 'Verizon' }, { name: 'Vertex' },
  { name: 'VF Corporation' }, { name: 'ViacomCBS' }, { name: 'ViaSat' }, { name: 'Vimeo' }, { name: 'Virgin Galactic' },
  { name: 'Visa' }, { name: 'Vistaprint' }, { name: 'VMware' }, { name: 'Vogue' }, { name: 'Volkswagen' },
  { name: 'Volvo' }, { name: 'Vonage' }, { name: 'Vox Media' }, { name: 'Vroom' }, { name: 'Vultr' },
  { name: 'Walgreens' }, { name: 'Walmart' }, { name: 'Walt Disney' }, { name: 'Warby Parker' }, { name: 'Warner Bros' },
  { name: 'Warner Music Group' }, { name: 'Washington Post' }, { name: 'Waste Management' }, { name: 'Wayfair' }, { name: 'Waymo' },
  { name: 'Wealthfront' }, { name: 'Webflow' }, { name: 'WebMD' }, { name: 'Weight Watchers' }, { name: 'Wells Fargo' },
  { name: 'Western Digital' }, { name: 'Western Union' }, { name: 'WeWork' }, { name: 'WhatsApp' }, { name: 'Whole Foods' },
  { name: 'Wikipedia' }, { name: 'Williams-Sonoma' }, { name: 'Wish' }, { name: 'Wix' }, { name: 'Wolfram' },
  { name: 'Workday' }, { name: 'Workiva' }, { name: 'World Bank' }, { name: 'WP Engine' }, { name: 'WPP' },
  { name: 'Wrike' }, { name: 'Wyze' }, { name: 'X' }, { name: 'Xbox' }, { name: 'Xero' },
  { name: 'Xilinx' }, { name: 'Xfinity' }, { name: 'Yahoo' }, { name: 'Yammer' }, { name: 'Yelp' },
  { name: 'Yext' }, { name: 'Y Combinator' }, { name: 'YouTube' }, { name: 'Zalando' }, { name: 'Zapier' },
  { name: 'Zebra Technologies' }, { name: 'Zendesk' }, { name: 'Zenefits' }, { name: 'Zillow' }, { name: 'Zocdoc' },
  { name: 'Zoho' }, { name: 'Zomato' }, { name: 'Zoom' }, { name: 'ZoomInfo' }, { name: 'Zoox' },
  { name: 'Zscaler' }, { name: 'Zulily' }, { name: 'Zuora' }, { name: 'Zynga' }
]

// ---------------------------------------------------------------------------
// MAIN SEED LOGIC
// ---------------------------------------------------------------------------

async function main() {
  const ALL = [...COMPANIES, ...DISCOVERY_COMPANIES]

  console.log(`🚀 Seeding ${ALL.length} companies (curated + discovery)...`)
  let added = 0
  let skipped = 0

  for (const c of ALL) {
    const slug = slugify(c.name)

    // Check if exists
    const existing = await prisma.company.findFirst({
      where: { OR: [{ slug }, { name: c.name }] }
    })

    if (existing) {
      // If we discovered an ATS for an existing company, patch it in
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

    // Determine ATS provider
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
      // NOTE: for Workday / Workable / SmartRecruiters / etc. we leave provider null for now.
    }

    // Best-guess website if not explicitly provided
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

main().catch((err) => {
  console.error(err)
  return prisma.$disconnect()
})
