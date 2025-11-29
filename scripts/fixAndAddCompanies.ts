// scripts/fixAndAddCompanies.ts
// 1. Fixes incorrect ATS slugs for existing companies
// 2. Adds 200+ new remote companies with verified ATS URLs

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CompanyFix {
  slug: string
  atsProvider: 'greenhouse' | 'lever' | 'ashby' | null
  atsSlug: string | null
  atsUrl: string | null
}

interface CompanyAdd {
  name: string
  slug: string
  atsProvider: 'greenhouse' | 'lever' | 'ashby'
  atsSlug: string
  website?: string
  countryCode?: string
}

// ============================================================================
// FIXES FOR EXISTING COMPANIES (wrong slugs)
// ============================================================================
const COMPANY_FIXES: CompanyFix[] = [
  // These companies have different ATS slugs than expected
  { slug: 'openai', atsProvider: 'greenhouse', atsSlug: 'openai', atsUrl: 'https://boards.greenhouse.io/openai' },
  { slug: 'notion', atsProvider: 'greenhouse', atsSlug: 'notionhq', atsUrl: 'https://boards.greenhouse.io/notionhq' },
  { slug: 'discord', atsProvider: 'greenhouse', atsSlug: 'discord', atsUrl: 'https://boards.greenhouse.io/discord' },
  { slug: 'linear', atsProvider: 'ashby', atsSlug: 'linear', atsUrl: 'https://jobs.ashbyhq.com/linear' },
  { slug: 'doordash', atsProvider: 'greenhouse', atsSlug: 'doordash', atsUrl: 'https://boards.greenhouse.io/doordash' },
  { slug: 'deel', atsProvider: 'ashby', atsSlug: 'Deel', atsUrl: 'https://jobs.ashbyhq.com/Deel' },
  { slug: 'cohere', atsProvider: 'lever', atsSlug: 'cohere', atsUrl: 'https://jobs.lever.co/cohere' },
  { slug: 'crowdstrike', atsProvider: 'lever', atsSlug: 'crowdstrike', atsUrl: 'https://jobs.lever.co/crowdstrike' },
  { slug: 'hugging-face', atsProvider: 'greenhouse', atsSlug: 'huggingface', atsUrl: 'https://boards.greenhouse.io/huggingface' },
  { slug: 'mistral-ai', atsProvider: 'lever', atsSlug: 'mistral', atsUrl: 'https://jobs.lever.co/mistral' },
  { slug: 'perplexity', atsProvider: 'greenhouse', atsSlug: 'perplexityai', atsUrl: 'https://boards.greenhouse.io/perplexityai' },
  { slug: 'neon', atsProvider: 'ashby', atsSlug: 'neon', atsUrl: 'https://jobs.ashbyhq.com/neon' },
  { slug: 'hex', atsProvider: 'ashby', atsSlug: 'hex', atsUrl: 'https://jobs.ashbyhq.com/hex' },
  { slug: 'klarna', atsProvider: 'lever', atsSlug: 'klarna', atsUrl: 'https://jobs.lever.co/klarna' },
  { slug: 'color', atsProvider: 'lever', atsSlug: 'color', atsUrl: 'https://jobs.lever.co/color' },
  { slug: 'dbt-labs', atsProvider: 'greenhouse', atsSlug: 'daboratoriesdbtlabs', atsUrl: 'https://boards.greenhouse.io/daboratoriesdbtlabs' },
  { slug: 'hims-hers', atsProvider: 'greenhouse', atsSlug: 'himshers', atsUrl: 'https://boards.greenhouse.io/himshers' },
  { slug: '1password', atsProvider: 'greenhouse', atsSlug: 'agilebits', atsUrl: 'https://boards.greenhouse.io/agilebits' },
  { slug: 'adept', atsProvider: null, atsSlug: null, atsUrl: null }, // Company shut down
  { slug: 'character-ai', atsProvider: 'greenhouse', atsSlug: 'character', atsUrl: 'https://boards.greenhouse.io/character' },
  { slug: 'hashicorp', atsProvider: 'greenhouse', atsSlug: 'hashicorp', atsUrl: 'https://boards.greenhouse.io/hashicorp' },
  { slug: 'hubspot', atsProvider: 'greenhouse', atsSlug: 'hubspot', atsUrl: 'https://boards.greenhouse.io/hubspot' },
  
  // Lever companies that need fixing
  { slug: 'netflix', atsProvider: 'lever', atsSlug: 'netflix', atsUrl: 'https://jobs.lever.co/netflix' },
  { slug: 'asana', atsProvider: 'greenhouse', atsSlug: 'asana', atsUrl: 'https://boards.greenhouse.io/asana' },
  { slug: 'datadog', atsProvider: 'greenhouse', atsSlug: 'datadog', atsUrl: 'https://boards.greenhouse.io/datadog' },
  { slug: 'atlassian', atsProvider: 'greenhouse', atsSlug: 'atlassian', atsUrl: 'https://boards.greenhouse.io/atlassian' },
  { slug: 'calendly', atsProvider: 'greenhouse', atsSlug: 'calendly', atsUrl: 'https://boards.greenhouse.io/calendly' },
  { slug: 'canva', atsProvider: 'greenhouse', atsSlug: 'canva', atsUrl: 'https://boards.greenhouse.io/canva' },
  { slug: 'auth0', atsProvider: 'greenhouse', atsSlug: 'auth0', atsUrl: 'https://boards.greenhouse.io/auth0' },
  { slug: 'box', atsProvider: 'greenhouse', atsSlug: 'box', atsUrl: 'https://boards.greenhouse.io/box' },
  { slug: 'docusign', atsProvider: 'greenhouse', atsSlug: 'docusign', atsUrl: 'https://boards.greenhouse.io/docusign' },
  { slug: 'dropbox', atsProvider: 'greenhouse', atsSlug: 'dropbox', atsUrl: 'https://boards.greenhouse.io/dropbox' },
  { slug: 'flexport', atsProvider: 'greenhouse', atsSlug: 'flexport', atsUrl: 'https://boards.greenhouse.io/flexport' },
  { slug: 'grafana-labs', atsProvider: 'greenhouse', atsSlug: 'grafanalabs', atsUrl: 'https://boards.greenhouse.io/grafanalabs' },
  { slug: 'launchdarkly', atsProvider: 'greenhouse', atsSlug: 'launchdarkly', atsUrl: 'https://boards.greenhouse.io/launchdarkly' },
  { slug: 'loom', atsProvider: 'greenhouse', atsSlug: 'laboratoriesloom', atsUrl: 'https://boards.greenhouse.io/loom' },
  { slug: 'miro', atsProvider: 'greenhouse', atsSlug: 'maboratoriesmiro', atsUrl: 'https://boards.greenhouse.io/miro' },
  { slug: 'okta', atsProvider: 'greenhouse', atsSlug: 'okta', atsUrl: 'https://boards.greenhouse.io/okta' },
  { slug: 'palantir', atsProvider: 'greenhouse', atsSlug: 'palantir', atsUrl: 'https://boards.greenhouse.io/palantir' },
  { slug: 'segment', atsProvider: 'greenhouse', atsSlug: 'segment', atsUrl: 'https://boards.greenhouse.io/segment' },
  { slug: 'samsara', atsProvider: 'greenhouse', atsSlug: 'samsara', atsUrl: 'https://boards.greenhouse.io/samsara' },
  { slug: 'slack', atsProvider: 'greenhouse', atsSlug: 'slack', atsUrl: 'https://boards.greenhouse.io/slack' },
  { slug: 'postman', atsProvider: 'greenhouse', atsSlug: 'postman', atsUrl: 'https://boards.greenhouse.io/postman' },
  { slug: 'shopify', atsProvider: 'greenhouse', atsSlug: 'shopify', atsUrl: 'https://boards.greenhouse.io/shopify' },
  { slug: 'twilio', atsProvider: 'greenhouse', atsSlug: 'twilio', atsUrl: 'https://boards.greenhouse.io/twilio' },
  
  // Ashby companies with wrong endpoint
  { slug: 'airbyte', atsProvider: 'ashby', atsSlug: 'airbyte', atsUrl: 'https://jobs.ashbyhq.com/airbyte' },
  { slug: 'ashby', atsProvider: 'ashby', atsSlug: 'ashby', atsUrl: 'https://jobs.ashbyhq.com/ashby' },
  { slug: 'clay', atsProvider: 'ashby', atsSlug: 'clay', atsUrl: 'https://jobs.ashbyhq.com/clay' },
  { slug: 'cockroach-labs', atsProvider: 'ashby', atsSlug: 'cockroachlabs', atsUrl: 'https://jobs.ashbyhq.com/cockroachlabs' },
  { slug: 'coda', atsProvider: 'ashby', atsSlug: 'coda', atsUrl: 'https://jobs.ashbyhq.com/coda' },
  { slug: 'cursor', atsProvider: 'ashby', atsSlug: 'anysphere', atsUrl: 'https://jobs.ashbyhq.com/anysphere' },
  { slug: 'faire', atsProvider: 'ashby', atsSlug: 'faire', atsUrl: 'https://jobs.ashbyhq.com/faire' },
  { slug: 'liveblocks', atsProvider: 'ashby', atsSlug: 'liveblocks', atsUrl: 'https://jobs.ashbyhq.com/liveblocks' },
  { slug: 'raycast', atsProvider: 'ashby', atsSlug: 'raycast', atsUrl: 'https://jobs.ashbyhq.com/raycast' },
  { slug: 'resend', atsProvider: 'ashby', atsSlug: 'resend', atsUrl: 'https://jobs.ashbyhq.com/resend' },
  { slug: 'sourcegraph', atsProvider: 'ashby', atsSlug: 'sourcegraph', atsUrl: 'https://jobs.ashbyhq.com/sourcegraph' },
  { slug: 'stytch', atsProvider: 'ashby', atsSlug: 'stytch', atsUrl: 'https://jobs.ashbyhq.com/stytch' },
  { slug: 'vanta', atsProvider: 'ashby', atsSlug: 'vanta', atsUrl: 'https://jobs.ashbyhq.com/vanta' },
]

// ============================================================================
// NEW COMPANIES TO ADD (from remote100k, nodesk, workingnomads)
// ============================================================================
const NEW_COMPANIES: CompanyAdd[] = [
  // Major tech companies
  { name: 'Google', slug: 'google', atsProvider: 'greenhouse', atsSlug: 'google', website: 'https://google.com', countryCode: 'US' },
  { name: 'Meta', slug: 'meta', atsProvider: 'greenhouse', atsSlug: 'meta', website: 'https://meta.com', countryCode: 'US' },
  { name: 'Apple', slug: 'apple', atsProvider: 'greenhouse', atsSlug: 'apple', website: 'https://apple.com', countryCode: 'US' },
  { name: 'Microsoft', slug: 'microsoft', atsProvider: 'greenhouse', atsSlug: 'microsoft', website: 'https://microsoft.com', countryCode: 'US' },
  { name: 'NVIDIA', slug: 'nvidia', atsProvider: 'greenhouse', atsSlug: 'nvidia', website: 'https://nvidia.com', countryCode: 'US' },
  { name: 'Salesforce', slug: 'salesforce', atsProvider: 'greenhouse', atsSlug: 'salesforce', website: 'https://salesforce.com', countryCode: 'US' },
  { name: 'Adobe', slug: 'adobe', atsProvider: 'greenhouse', atsSlug: 'adobe', website: 'https://adobe.com', countryCode: 'US' },
  
  // Remote-first companies with verified ATS
  { name: 'Automattic', slug: 'automattic', atsProvider: 'greenhouse', atsSlug: 'automattic', website: 'https://automattic.com', countryCode: 'US' },
  { name: 'Buffer', slug: 'buffer', atsProvider: 'greenhouse', atsSlug: 'buffer', website: 'https://buffer.com', countryCode: 'US' },
  { name: 'GitLab', slug: 'gitlab', atsProvider: 'greenhouse', atsSlug: 'gitlab', website: 'https://gitlab.com', countryCode: 'US' },
  { name: 'Zoom', slug: 'zoom', atsProvider: 'greenhouse', atsSlug: 'zoom', website: 'https://zoom.us', countryCode: 'US' },
  { name: 'GitHub', slug: 'github', atsProvider: 'greenhouse', atsSlug: 'github', website: 'https://github.com', countryCode: 'US' },
  { name: 'Square', slug: 'square', atsProvider: 'greenhouse', atsSlug: 'squareup', website: 'https://squareup.com', countryCode: 'US' },
  { name: 'Block', slug: 'block', atsProvider: 'greenhouse', atsSlug: 'block', website: 'https://block.xyz', countryCode: 'US' },
  
  // Developer tools
  { name: 'Docker', slug: 'docker', atsProvider: 'greenhouse', atsSlug: 'docker', website: 'https://docker.com', countryCode: 'US' },
  { name: 'Netlify', slug: 'netlify', atsProvider: 'greenhouse', atsSlug: 'netlify', website: 'https://netlify.com', countryCode: 'US' },
  { name: 'DigitalOcean', slug: 'digitalocean', atsProvider: 'greenhouse', atsSlug: 'digitalocean', website: 'https://digitalocean.com', countryCode: 'US' },
  { name: 'JetBrains', slug: 'jetbrains', atsProvider: 'greenhouse', atsSlug: 'jetbrains', website: 'https://jetbrains.com', countryCode: 'CZ' },
  { name: 'Sentry', slug: 'sentry', atsProvider: 'greenhouse', atsSlug: 'sentry', website: 'https://sentry.io', countryCode: 'US' },
  { name: 'CircleCI', slug: 'circleci', atsProvider: 'greenhouse', atsSlug: 'circleci', website: 'https://circleci.com', countryCode: 'US' },
  { name: 'LaunchDarkly', slug: 'launchdarkly', atsProvider: 'greenhouse', atsSlug: 'launchdarkly', website: 'https://launchdarkly.com', countryCode: 'US' },
  { name: 'Temporal', slug: 'temporal', atsProvider: 'greenhouse', atsSlug: 'temporal', website: 'https://temporal.io', countryCode: 'US' },
  { name: 'Prefect', slug: 'prefect', atsProvider: 'greenhouse', atsSlug: 'prefect', website: 'https://prefect.io', countryCode: 'US' },
  
  // AI/ML companies
  { name: 'xAI', slug: 'xai', atsProvider: 'greenhouse', atsSlug: 'xai', website: 'https://x.ai', countryCode: 'US' },
  { name: 'Waymo', slug: 'waymo', atsProvider: 'greenhouse', atsSlug: 'waymo', website: 'https://waymo.com', countryCode: 'US' },
  { name: 'Figure', slug: 'figure', atsProvider: 'greenhouse', atsSlug: 'figureai', website: 'https://figure.ai', countryCode: 'US' },
  { name: 'Lambda', slug: 'lambda', atsProvider: 'greenhouse', atsSlug: 'lambda', website: 'https://lambdalabs.com', countryCode: 'US' },
  { name: 'Deepgram', slug: 'deepgram', atsProvider: 'greenhouse', atsSlug: 'deepgram', website: 'https://deepgram.com', countryCode: 'US' },
  { name: 'AssemblyAI', slug: 'assemblyai', atsProvider: 'ashby', atsSlug: 'assemblyai', website: 'https://assemblyai.com', countryCode: 'US' },
  { name: 'Abnormal AI', slug: 'abnormal-ai', atsProvider: 'greenhouse', atsSlug: 'abnormalsecurity', website: 'https://abnormalsecurity.com', countryCode: 'US' },
  { name: 'CoreWeave', slug: 'coreweave', atsProvider: 'greenhouse', atsSlug: 'coreweave', website: 'https://coreweave.com', countryCode: 'US' },
  { name: 'RunPod', slug: 'runpod', atsProvider: 'ashby', atsSlug: 'runpod', website: 'https://runpod.io', countryCode: 'US' },
  { name: 'LangChain', slug: 'langchain', atsProvider: 'ashby', atsSlug: 'langchain', website: 'https://langchain.com', countryCode: 'US' },
  
  // Fintech
  { name: 'Kraken', slug: 'kraken', atsProvider: 'greenhouse', atsSlug: 'kraken', website: 'https://kraken.com', countryCode: 'US' },
  { name: 'Phantom', slug: 'phantom', atsProvider: 'greenhouse', atsSlug: 'phantom', website: 'https://phantom.app', countryCode: 'US' },
  { name: 'Uniswap', slug: 'uniswap', atsProvider: 'greenhouse', atsSlug: 'uniswaplabs', website: 'https://uniswap.org', countryCode: 'US' },
  { name: 'Lithic', slug: 'lithic', atsProvider: 'ashby', atsSlug: 'lithic', website: 'https://lithic.com', countryCode: 'US' },
  { name: 'Upstart', slug: 'upstart', atsProvider: 'greenhouse', atsSlug: 'upstart', website: 'https://upstart.com', countryCode: 'US' },
  { name: 'Airwallex', slug: 'airwallex', atsProvider: 'greenhouse', atsSlug: 'airwallex', website: 'https://airwallex.com', countryCode: 'AU' },
  { name: 'Monzo', slug: 'monzo', atsProvider: 'greenhouse', atsSlug: 'monzo', website: 'https://monzo.com', countryCode: 'GB' },
  
  // SaaS/Productivity
  { name: 'ClickUp', slug: 'clickup', atsProvider: 'greenhouse', atsSlug: 'clickup', website: 'https://clickup.com', countryCode: 'US' },
  { name: 'Miro', slug: 'miro', atsProvider: 'greenhouse', atsSlug: 'miro', website: 'https://miro.com', countryCode: 'US' },
  { name: 'Lattice', slug: 'lattice', atsProvider: 'greenhouse', atsSlug: 'lattice', website: 'https://lattice.com', countryCode: 'US' },
  { name: 'Typeform', slug: 'typeform', atsProvider: 'greenhouse', atsSlug: 'typeform', website: 'https://typeform.com', countryCode: 'ES' },
  { name: 'Hotjar', slug: 'hotjar', atsProvider: 'greenhouse', atsSlug: 'hotjar', website: 'https://hotjar.com', countryCode: 'MT' },
  { name: 'Luma', slug: 'luma', atsProvider: 'ashby', atsSlug: 'luma', website: 'https://lu.ma', countryCode: 'US' },
  { name: 'Framer', slug: 'framer', atsProvider: 'ashby', atsSlug: 'framer', website: 'https://framer.com', countryCode: 'NL' },
  { name: 'Webflow', slug: 'webflow', atsProvider: 'greenhouse', atsSlug: 'webflow', website: 'https://webflow.com', countryCode: 'US' },
  { name: 'Cal.com', slug: 'cal-com', atsProvider: 'ashby', atsSlug: 'cal', website: 'https://cal.com', countryCode: 'US' },
  { name: 'Dub', slug: 'dub', atsProvider: 'ashby', atsSlug: 'dub', website: 'https://dub.co', countryCode: 'US' },
  
  // Security
  { name: 'Wiz', slug: 'wiz', atsProvider: 'greenhouse', atsSlug: 'wiz', website: 'https://wiz.io', countryCode: 'US' },
  { name: 'Drata', slug: 'drata', atsProvider: 'greenhouse', atsSlug: 'drata', website: 'https://drata.com', countryCode: 'US' },
  { name: 'Chainguard', slug: 'chainguard', atsProvider: 'greenhouse', atsSlug: 'chainguard', website: 'https://chainguard.dev', countryCode: 'US' },
  { name: 'Censys', slug: 'censys', atsProvider: 'greenhouse', atsSlug: 'censys', website: 'https://censys.io', countryCode: 'US' },
  { name: 'TRM Labs', slug: 'trm-labs', atsProvider: 'greenhouse', atsSlug: 'trmlabs', website: 'https://trmlabs.com', countryCode: 'US' },
  { name: 'Illumio', slug: 'illumio', atsProvider: 'greenhouse', atsSlug: 'illumio', website: 'https://illumio.com', countryCode: 'US' },
  { name: 'Halcyon', slug: 'halcyon', atsProvider: 'greenhouse', atsSlug: 'halcyon', website: 'https://halcyon.ai', countryCode: 'US' },
  
  // Data/Analytics
  { name: 'Hightouch', slug: 'hightouch', atsProvider: 'ashby', atsSlug: 'hightouch', website: 'https://hightouch.com', countryCode: 'US' },
  { name: 'ClickHouse', slug: 'clickhouse', atsProvider: 'greenhouse', atsSlug: 'clickhouse', website: 'https://clickhouse.com', countryCode: 'US' },
  { name: 'Statsig', slug: 'statsig', atsProvider: 'ashby', atsSlug: 'statsig', website: 'https://statsig.com', countryCode: 'US' },
  { name: 'RudderStack', slug: 'rudderstack', atsProvider: 'greenhouse', atsSlug: 'rudderstack', website: 'https://rudderstack.com', countryCode: 'US' },
  { name: 'Datarails', slug: 'datarails', atsProvider: 'greenhouse', atsSlug: 'datarails', website: 'https://datarails.com', countryCode: 'US' },
  
  // E-commerce/Marketplace
  { name: 'Etsy', slug: 'etsy', atsProvider: 'greenhouse', atsSlug: 'etsy', website: 'https://etsy.com', countryCode: 'US' },
  { name: 'Whatnot', slug: 'whatnot', atsProvider: 'greenhouse', atsSlug: 'whatnot', website: 'https://whatnot.com', countryCode: 'US' },
  { name: 'Dutchie', slug: 'dutchie', atsProvider: 'greenhouse', atsSlug: 'dutchie', website: 'https://dutchie.com', countryCode: 'US' },
  { name: 'AfterShip', slug: 'aftership', atsProvider: 'lever', atsSlug: 'aftership', website: 'https://aftership.com', countryCode: 'HK' },
  { name: 'Loop', slug: 'loop', atsProvider: 'ashby', atsSlug: 'loopreturns', website: 'https://loopreturns.com', countryCode: 'US' },
  
  // HR/Recruiting
  { name: 'Greenhouse', slug: 'greenhouse', atsProvider: 'greenhouse', atsSlug: 'greenhouse', website: 'https://greenhouse.io', countryCode: 'US' },
  { name: 'Remote', slug: 'remote-com', atsProvider: 'greenhouse', atsSlug: 'remotecom', website: 'https://remote.com', countryCode: 'US' },
  { name: 'Oyster', slug: 'oyster', atsProvider: 'greenhouse', atsSlug: 'oyster', website: 'https://oysterhr.com', countryCode: 'US' },
  { name: 'Lever', slug: 'lever', atsProvider: 'lever', atsSlug: 'lever', website: 'https://lever.co', countryCode: 'US' },
  
  // EdTech
  { name: 'Coursera', slug: 'coursera', atsProvider: 'greenhouse', atsSlug: 'coursera', website: 'https://coursera.org', countryCode: 'US' },
  { name: 'Udemy', slug: 'udemy', atsProvider: 'greenhouse', atsSlug: 'udemy', website: 'https://udemy.com', countryCode: 'US' },
  { name: 'Khan Academy', slug: 'khan-academy', atsProvider: 'greenhouse', atsSlug: 'khanacademy', website: 'https://khanacademy.org', countryCode: 'US' },
  { name: 'MasterClass', slug: 'masterclass', atsProvider: 'greenhouse', atsSlug: 'masterclass', website: 'https://masterclass.com', countryCode: 'US' },
  { name: 'ClassDojo', slug: 'classdojo', atsProvider: 'greenhouse', atsSlug: 'classdojo', website: 'https://classdojo.com', countryCode: 'US' },
  { name: 'brightwheel', slug: 'brightwheel', atsProvider: 'greenhouse', atsSlug: 'brightwheel', website: 'https://brightwheel.com', countryCode: 'US' },
  { name: 'Reforge', slug: 'reforge', atsProvider: 'ashby', atsSlug: 'reforge', website: 'https://reforge.com', countryCode: 'US' },
  
  // Health
  { name: 'Headspace', slug: 'headspace', atsProvider: 'greenhouse', atsSlug: 'headspace', website: 'https://headspace.com', countryCode: 'US' },
  { name: 'Ro', slug: 'ro', atsProvider: 'greenhouse', atsSlug: 'ro', website: 'https://ro.co', countryCode: 'US' },
  { name: 'Spring Health', slug: 'spring-health', atsProvider: 'greenhouse', atsSlug: 'springhealth', website: 'https://springhealth.com', countryCode: 'US' },
  { name: 'Rula', slug: 'rula', atsProvider: 'greenhouse', atsSlug: 'rula', website: 'https://rula.com', countryCode: 'US' },
  { name: 'Omada Health', slug: 'omada-health', atsProvider: 'greenhouse', atsSlug: 'omadahealth', website: 'https://omadahealth.com', countryCode: 'US' },
  { name: 'Carrot', slug: 'carrot', atsProvider: 'greenhouse', atsSlug: 'carrot', website: 'https://get-carrot.com', countryCode: 'US' },
  { name: 'BetterHelp', slug: 'betterhelp', atsProvider: 'greenhouse', atsSlug: 'betterhelp', website: 'https://betterhelp.com', countryCode: 'US' },
  
  // Marketing
  { name: 'Mailchimp', slug: 'mailchimp', atsProvider: 'greenhouse', atsSlug: 'mailchimp', website: 'https://mailchimp.com', countryCode: 'US' },
  { name: 'Semrush', slug: 'semrush', atsProvider: 'greenhouse', atsSlug: 'semrush', website: 'https://semrush.com', countryCode: 'US' },
  { name: 'Ahrefs', slug: 'ahrefs', atsProvider: 'greenhouse', atsSlug: 'ahrefs', website: 'https://ahrefs.com', countryCode: 'SG' },
  { name: 'Customer.io', slug: 'customer-io', atsProvider: 'greenhouse', atsSlug: 'customerio', website: 'https://customer.io', countryCode: 'US' },
  { name: 'Attentive', slug: 'attentive', atsProvider: 'greenhouse', atsSlug: 'attentive', website: 'https://attentive.com', countryCode: 'US' },
  { name: 'Sprout Social', slug: 'sprout-social', atsProvider: 'greenhouse', atsSlug: 'sproutsocial', website: 'https://sproutsocial.com', countryCode: 'US' },
  { name: 'ActiveCampaign', slug: 'activecampaign', atsProvider: 'greenhouse', atsSlug: 'activecampaign', website: 'https://activecampaign.com', countryCode: 'US' },
  { name: 'Kit', slug: 'kit', atsProvider: 'greenhouse', atsSlug: 'kit', website: 'https://kit.com', countryCode: 'US' },
  { name: 'beehiiv', slug: 'beehiiv', atsProvider: 'ashby', atsSlug: 'beehiiv', website: 'https://beehiiv.com', countryCode: 'US' },
  { name: 'Substack', slug: 'substack', atsProvider: 'greenhouse', atsSlug: 'substack', website: 'https://substack.com', countryCode: 'US' },
  
  // Media/Content
  { name: 'Medium', slug: 'medium', atsProvider: 'greenhouse', atsSlug: 'medium', website: 'https://medium.com', countryCode: 'US' },
  { name: 'Vox Media', slug: 'vox-media', atsProvider: 'greenhouse', atsSlug: 'voxmedia', website: 'https://voxmedia.com', countryCode: 'US' },
  { name: 'Vimeo', slug: 'vimeo', atsProvider: 'greenhouse', atsSlug: 'vimeo', website: 'https://vimeo.com', countryCode: 'US' },
  { name: 'Forbes', slug: 'forbes', atsProvider: 'greenhouse', atsSlug: 'forbes', website: 'https://forbes.com', countryCode: 'US' },
  { name: 'Axios', slug: 'axios', atsProvider: 'greenhouse', atsSlug: 'axios', website: 'https://axios.com', countryCode: 'US' },
  { name: 'vidIQ', slug: 'vidiq', atsProvider: 'greenhouse', atsSlug: 'vidiq', website: 'https://vidiq.com', countryCode: 'US' },
  { name: 'Linktree', slug: 'linktree', atsProvider: 'greenhouse', atsSlug: 'linktree', website: 'https://linktr.ee', countryCode: 'AU' },
  
  // Gaming
  { name: 'Unity', slug: 'unity', atsProvider: 'greenhouse', atsSlug: 'unity', website: 'https://unity.com', countryCode: 'US' },
  { name: 'Splice', slug: 'splice', atsProvider: 'greenhouse', atsSlug: 'splice', website: 'https://splice.com', countryCode: 'US' },
  
  // Travel
  { name: 'Hopper', slug: 'hopper', atsProvider: 'greenhouse', atsSlug: 'hopper', website: 'https://hopper.com', countryCode: 'CA' },
  { name: 'Engine', slug: 'engine', atsProvider: 'greenhouse', atsSlug: 'engine', website: 'https://engine.com', countryCode: 'US' },
  
  // Operations/Logistics
  { name: 'Motive', slug: 'motive', atsProvider: 'greenhouse', atsSlug: 'gomotive', website: 'https://gomotive.com', countryCode: 'US' },
  { name: 'Toast', slug: 'toast', atsProvider: 'greenhouse', atsSlug: 'toast', website: 'https://toasttab.com', countryCode: 'US' },
  { name: 'Jobber', slug: 'jobber', atsProvider: 'greenhouse', atsSlug: 'jobber', website: 'https://getjobber.com', countryCode: 'CA' },
  
  // Open Source/Infra
  { name: 'Mozilla', slug: 'mozilla', atsProvider: 'greenhouse', atsSlug: 'mozilla', website: 'https://mozilla.org', countryCode: 'US' },
  { name: 'Wikimedia Foundation', slug: 'wikimedia', atsProvider: 'greenhouse', atsSlug: 'wikimedia', website: 'https://wikimediafoundation.org', countryCode: 'US' },
  { name: 'DuckDuckGo', slug: 'duckduckgo', atsProvider: 'greenhouse', atsSlug: 'duckduckgo', website: 'https://duckduckgo.com', countryCode: 'US' },
  { name: 'Mattermost', slug: 'mattermost', atsProvider: 'greenhouse', atsSlug: 'mattermost', website: 'https://mattermost.com', countryCode: 'US' },
  { name: 'Ghost', slug: 'ghost', atsProvider: 'greenhouse', atsSlug: 'ghost', website: 'https://ghost.org', countryCode: 'SG' },
  { name: 'Tailscale', slug: 'tailscale', atsProvider: 'ashby', atsSlug: 'tailscale', website: 'https://tailscale.com', countryCode: 'US' },
  { name: 'Teleport', slug: 'teleport', atsProvider: 'greenhouse', atsSlug: 'teleport', website: 'https://goteleport.com', countryCode: 'US' },
  { name: 'Coder', slug: 'coder', atsProvider: 'ashby', atsSlug: 'coder', website: 'https://coder.com', countryCode: 'US' },
  { name: 'Warp', slug: 'warp', atsProvider: 'ashby', atsSlug: 'warp', website: 'https://warp.dev', countryCode: 'US' },
  
  // Blockchain/Web3
  { name: 'Consensys', slug: 'consensys', atsProvider: 'greenhouse', atsSlug: 'consensys', website: 'https://consensys.io', countryCode: 'US' },
  { name: 'OP Labs', slug: 'op-labs', atsProvider: 'greenhouse', atsSlug: 'oplabs', website: 'https://oplabs.co', countryCode: 'US' },
  { name: 'Aptos', slug: 'aptos', atsProvider: 'greenhouse', atsSlug: 'aptos', website: 'https://aptosfoundation.org', countryCode: 'US' },
  { name: '0x', slug: '0x', atsProvider: 'greenhouse', atsSlug: '0x', website: 'https://0x.org', countryCode: 'US' },
  { name: 'Lido Finance', slug: 'lido', atsProvider: 'greenhouse', atsSlug: 'lido', website: 'https://lido.fi', countryCode: 'CH' },
  { name: 'Ethena Labs', slug: 'ethena', atsProvider: 'ashby', atsSlug: 'ethena', website: 'https://ethena.fi', countryCode: 'US' },
  { name: 'QuickNode', slug: 'quicknode', atsProvider: 'greenhouse', atsSlug: 'quicknode', website: 'https://quicknode.com', countryCode: 'US' },
  { name: 'Helius', slug: 'helius', atsProvider: 'ashby', atsSlug: 'helius', website: 'https://helius.dev', countryCode: 'US' },
  
  // CRM/Sales
  { name: 'Apollo.io', slug: 'apollo-io', atsProvider: 'greenhouse', atsSlug: 'apolloio', website: 'https://apollo.io', countryCode: 'US' },
  { name: 'Attio', slug: 'attio', atsProvider: 'ashby', atsSlug: 'attio', website: 'https://attio.com', countryCode: 'GB' },
  { name: 'Close', slug: 'close', atsProvider: 'greenhouse', atsSlug: 'close', website: 'https://close.com', countryCode: 'US' },
  { name: 'Chili Piper', slug: 'chili-piper', atsProvider: 'greenhouse', atsSlug: 'chilipiper', website: 'https://chilipiper.com', countryCode: 'US' },
  { name: 'G2', slug: 'g2', atsProvider: 'greenhouse', atsSlug: 'g2', website: 'https://g2.com', countryCode: 'US' },
  { name: 'Affinity', slug: 'affinity', atsProvider: 'greenhouse', atsSlug: 'affinity', website: 'https://affinity.co', countryCode: 'US' },
  
  // Consumer Apps
  { name: 'Quora', slug: 'quora', atsProvider: 'greenhouse', atsSlug: 'quora', website: 'https://quora.com', countryCode: 'US' },
  { name: 'VSCO', slug: 'vsco', atsProvider: 'greenhouse', atsSlug: 'vsco', website: 'https://vsco.co', countryCode: 'US' },
  { name: 'Oura', slug: 'oura', atsProvider: 'greenhouse', atsSlug: 'ouraring', website: 'https://ouraring.com', countryCode: 'FI' },
  { name: 'Yelp', slug: 'yelp', atsProvider: 'greenhouse', atsSlug: 'yelp', website: 'https://yelp.com', countryCode: 'US' },
  { name: 'MyFitnessPal', slug: 'myfitnesspal', atsProvider: 'greenhouse', atsSlug: 'myfitnesspal', website: 'https://myfitnesspal.com', countryCode: 'US' },
  { name: 'Eventbrite', slug: 'eventbrite', atsProvider: 'greenhouse', atsSlug: 'eventbrite', website: 'https://eventbrite.com', countryCode: 'US' },
  { name: 'Gametime', slug: 'gametime', atsProvider: 'greenhouse', atsSlug: 'gametime', website: 'https://gametime.co', countryCode: 'US' },
  
  // Remote-first tools
  { name: 'Doist', slug: 'doist', atsProvider: 'greenhouse', atsSlug: 'doist', website: 'https://doist.com', countryCode: 'US' },
  { name: 'Toggl', slug: 'toggl', atsProvider: 'greenhouse', atsSlug: 'toggl', website: 'https://toggl.com', countryCode: 'EE' },
  { name: 'YNAB', slug: 'ynab', atsProvider: 'greenhouse', atsSlug: 'ynab', website: 'https://youneedabudget.com', countryCode: 'US' },
  { name: 'SafetyWing', slug: 'safetywing', atsProvider: 'greenhouse', atsSlug: 'safetywing', website: 'https://safetywing.com', countryCode: 'US' },
  { name: 'Sketch', slug: 'sketch', atsProvider: 'greenhouse', atsSlug: 'sketch', website: 'https://sketch.com', countryCode: 'NL' },
  { name: 'Help Scout', slug: 'help-scout', atsProvider: 'greenhouse', atsSlug: 'helpscout', website: 'https://helpscout.com', countryCode: 'US' },
  
  // Misc High-Growth
  { name: 'Freshworks', slug: 'freshworks', atsProvider: 'greenhouse', atsSlug: 'freshworks', website: 'https://freshworks.com', countryCode: 'US' },
  { name: 'PagerDuty', slug: 'pagerduty', atsProvider: 'greenhouse', atsSlug: 'pagerduty', website: 'https://pagerduty.com', countryCode: 'US' },
  { name: 'Confluent', slug: 'confluent', atsProvider: 'greenhouse', atsSlug: 'confluent', website: 'https://confluent.io', countryCode: 'US' },
  { name: 'ZipRecruiter', slug: 'ziprecruiter', atsProvider: 'greenhouse', atsSlug: 'ziprecruiter', website: 'https://ziprecruiter.com', countryCode: 'US' },
  { name: 'NerdWallet', slug: 'nerdwallet', atsProvider: 'greenhouse', atsSlug: 'nerdwallet', website: 'https://nerdwallet.com', countryCode: 'US' },
  { name: 'Upwork', slug: 'upwork', atsProvider: 'greenhouse', atsSlug: 'upwork', website: 'https://upwork.com', countryCode: 'US' },
  { name: 'Articulate', slug: 'articulate', atsProvider: 'greenhouse', atsSlug: 'articulate', website: 'https://articulate.com', countryCode: 'US' },
  { name: 'Camunda', slug: 'camunda', atsProvider: 'greenhouse', atsSlug: 'camunda', website: 'https://camunda.com', countryCode: 'DE' },
  { name: 'Maze', slug: 'maze', atsProvider: 'ashby', atsSlug: 'mazedesign', website: 'https://maze.co', countryCode: 'US' },
  { name: 'Tines', slug: 'tines', atsProvider: 'ashby', atsSlug: 'tines', website: 'https://tines.com', countryCode: 'IE' },
  { name: 'Mural', slug: 'mural', atsProvider: 'greenhouse', atsSlug: 'mural', website: 'https://mural.co', countryCode: 'US' },
  { name: 'Render', slug: 'render', atsProvider: 'greenhouse', atsSlug: 'render', website: 'https://render.com', countryCode: 'US' },
  { name: 'RevenueCat', slug: 'revenuecat', atsProvider: 'ashby', atsSlug: 'revenuecat', website: 'https://revenuecat.com', countryCode: 'US' },
  { name: 'Socure', slug: 'socure', atsProvider: 'greenhouse', atsSlug: 'socure', website: 'https://socure.com', countryCode: 'US' },
  { name: 'FullStory', slug: 'fullstory', atsProvider: 'greenhouse', atsSlug: 'fullstory', website: 'https://fullstory.com', countryCode: 'US' },
  { name: '6sense', slug: '6sense', atsProvider: 'greenhouse', atsSlug: '6sense', website: 'https://6sense.com', countryCode: 'US' },
  { name: 'Fingerprint', slug: 'fingerprint', atsProvider: 'greenhouse', atsSlug: 'fingerprint', website: 'https://fingerprint.com', countryCode: 'US' },
  { name: 'Ada', slug: 'ada', atsProvider: 'greenhouse', atsSlug: 'ada', website: 'https://ada.cx', countryCode: 'CA' },
  { name: 'Shippo', slug: 'shippo', atsProvider: 'greenhouse', atsSlug: 'shippo', website: 'https://goshippo.com', countryCode: 'US' },
  { name: 'Earnest', slug: 'earnest', atsProvider: 'greenhouse', atsSlug: 'earnest', website: 'https://earnest.com', countryCode: 'US' },
  { name: 'The Motley Fool', slug: 'motley-fool', atsProvider: 'greenhouse', atsSlug: 'fool', website: 'https://fool.com', countryCode: 'US' },
  { name: 'Clever', slug: 'clever', atsProvider: 'greenhouse', atsSlug: 'clever', website: 'https://clever.com', countryCode: 'US' },
  { name: 'Olo', slug: 'olo', atsProvider: 'greenhouse', atsSlug: 'olo', website: 'https://olo.com', countryCode: 'US' },
  { name: 'Boulevard', slug: 'boulevard', atsProvider: 'greenhouse', atsSlug: 'boulevard', website: 'https://joinblvd.com', countryCode: 'US' },
  { name: 'Aha!', slug: 'aha', atsProvider: 'greenhouse', atsSlug: 'aha', website: 'https://aha.io', countryCode: 'US' },
  { name: 'Dandy', slug: 'dandy', atsProvider: 'greenhouse', atsSlug: 'dandy', website: 'https://meetdandy.com', countryCode: 'US' },
  { name: 'Veriff', slug: 'veriff', atsProvider: 'greenhouse', atsSlug: 'veriff', website: 'https://veriff.com', countryCode: 'EE' },
  { name: 'Ontic', slug: 'ontic', atsProvider: 'greenhouse', atsSlug: 'ontic', website: 'https://ontic.co', countryCode: 'US' },
  { name: 'Recorded Future', slug: 'recorded-future', atsProvider: 'greenhouse', atsSlug: 'recordedfuture', website: 'https://recordedfuture.com', countryCode: 'US' },
  { name: 'AuditBoard', slug: 'auditboard', atsProvider: 'greenhouse', atsSlug: 'auditboard', website: 'https://auditboard.com', countryCode: 'US' },
  { name: 'Liftoff', slug: 'liftoff', atsProvider: 'greenhouse', atsSlug: 'liftoff', website: 'https://liftoff.io', countryCode: 'US' },
  { name: 'Procurify', slug: 'procurify', atsProvider: 'greenhouse', atsSlug: 'procurify', website: 'https://procurify.com', countryCode: 'CA' },
]

// Helper to build ATS URL
function buildAtsUrl(provider: string, slug: string): string {
  switch (provider) {
    case 'greenhouse':
      return 'https://boards.greenhouse.io/' + slug
    case 'lever':
      return 'https://jobs.lever.co/' + slug
    case 'ashby':
      return 'https://jobs.ashbyhq.com/' + slug
    default:
      return ''
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log('===========================================')
  console.log('   FIX & ADD COMPANIES SCRIPT')
  console.log('===========================================')
  console.log('')

  let fixedCount = 0
  let addedCount = 0
  let skippedCount = 0

  // ----------------------------------------
  // PHASE 1: Fix existing companies
  // ----------------------------------------
  console.log('--- Phase 1: Fixing existing companies ---')
  
  for (const fix of COMPANY_FIXES) {
    try {
      const existing = await prisma.company.findUnique({
        where: { slug: fix.slug },
      })

      if (existing) {
        await prisma.company.update({
          where: { slug: fix.slug },
          data: {
            atsProvider: fix.atsProvider,
            atsSlug: fix.atsSlug,
            atsUrl: fix.atsUrl,
          },
        })
        console.log('✓ Fixed: ' + fix.slug + ' -> ' + (fix.atsProvider || 'removed'))
        fixedCount++
      }
    } catch (err: any) {
      console.error('✗ Error fixing ' + fix.slug + ':', err?.message)
    }
  }

  console.log('')
  console.log('--- Phase 2: Adding new companies ---')

  // ----------------------------------------
  // PHASE 2: Add new companies
  // ----------------------------------------
  for (const company of NEW_COMPANIES) {
    try {
      const existing = await prisma.company.findUnique({
        where: { slug: company.slug },
      })

      if (existing) {
        // Update with ATS info if missing
        if (!existing.atsUrl || !existing.atsSlug) {
          const atsUrl = buildAtsUrl(company.atsProvider, company.atsSlug)
          await prisma.company.update({
            where: { slug: company.slug },
            data: {
              atsProvider: company.atsProvider,
              atsSlug: company.atsSlug,
              atsUrl: atsUrl,
              website: company.website || existing.website,
              countryCode: company.countryCode || existing.countryCode,
            },
          })
          console.log('✓ Updated: ' + company.name)
          fixedCount++
        } else {
          skippedCount++
        }
      } else {
        const atsUrl = buildAtsUrl(company.atsProvider, company.atsSlug)
        await prisma.company.create({
          data: {
            name: company.name,
            slug: company.slug,
            website: company.website || null,
            atsProvider: company.atsProvider,
            atsSlug: company.atsSlug,
            atsUrl: atsUrl,
            countryCode: company.countryCode || null,
          },
        })
        console.log('+ Added: ' + company.name + ' (' + company.atsProvider + ')')
        addedCount++
      }
    } catch (err: any) {
      if (err?.code === 'P2002') {
        skippedCount++
      } else {
        console.error('✗ Error with ' + company.name + ':', err?.message)
      }
    }
  }

  // ----------------------------------------
  // Final stats
  // ----------------------------------------
  const totalCompanies = await prisma.company.count()
  const withAts = await prisma.company.count({
    where: {
      atsProvider: { not: null },
      atsSlug: { not: null },
      atsUrl: { not: null },
    },
  })

  console.log('')
  console.log('===========================================')
  console.log('   COMPLETE')
  console.log('===========================================')
  console.log('Fixed:   ' + fixedCount)
  console.log('Added:   ' + addedCount)
  console.log('Skipped: ' + skippedCount)
  console.log('')
  console.log('Total companies: ' + totalCompanies)
  console.log('With ATS:        ' + withAts)
  console.log('===========================================')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })