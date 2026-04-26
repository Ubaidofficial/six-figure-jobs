// scripts/seedTopCompanies.ts
// Seeds a curated set of ATS-backed companies and keeps ATS metadata aligned.

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

interface CompanySeed {
  name: string
  slug: string
  atsProvider: 'greenhouse' | 'lever' | 'ashby'
  atsSlug: string
  website?: string
  countryCode?: string
}

// ============================================================================
// GREENHOUSE COMPANIES (100+)
// ============================================================================
const GREENHOUSE_COMPANIES: CompanySeed[] = [
  // AI / ML
  { name: 'OpenAI', slug: 'openai', atsProvider: 'greenhouse', atsSlug: 'openai', website: 'https://openai.com', countryCode: 'US' },
  { name: 'Anthropic', slug: 'anthropic', atsProvider: 'greenhouse', atsSlug: 'anthropic', website: 'https://anthropic.com', countryCode: 'US' },
  { name: 'Scale AI', slug: 'scale-ai', atsProvider: 'greenhouse', atsSlug: 'scaleai', website: 'https://scale.com', countryCode: 'US' },
  { name: 'Hugging Face', slug: 'hugging-face', atsProvider: 'greenhouse', atsSlug: 'huggingface', website: 'https://huggingface.co', countryCode: 'US' },
  { name: 'Cohere', slug: 'cohere', atsProvider: 'greenhouse', atsSlug: 'cohere', website: 'https://cohere.com', countryCode: 'CA' },
  { name: 'Runway', slug: 'runway', atsProvider: 'greenhouse', atsSlug: 'runwayml', website: 'https://runway.com', countryCode: 'US' },
  { name: 'Stability AI', slug: 'stability-ai', atsProvider: 'greenhouse', atsSlug: 'stabilityai', website: 'https://stability.ai', countryCode: 'GB' },
  { name: 'Character AI', slug: 'character-ai', atsProvider: 'greenhouse', atsSlug: 'character', website: 'https://character.ai', countryCode: 'US' },
  { name: 'Inflection AI', slug: 'inflection-ai', atsProvider: 'greenhouse', atsSlug: 'inflectionai', website: 'https://inflection.ai', countryCode: 'US' },
  
  // Fintech
  { name: 'Stripe', slug: 'stripe', atsProvider: 'greenhouse', atsSlug: 'stripe', website: 'https://stripe.com', countryCode: 'US' },
  { name: 'Coinbase', slug: 'coinbase', atsProvider: 'greenhouse', atsSlug: 'coinbase', website: 'https://coinbase.com', countryCode: 'US' },
  { name: 'Plaid', slug: 'plaid', atsProvider: 'greenhouse', atsSlug: 'plaid', website: 'https://plaid.com', countryCode: 'US' },
  { name: 'Brex', slug: 'brex', atsProvider: 'greenhouse', atsSlug: 'brex', website: 'https://brex.com', countryCode: 'US' },
  { name: 'Ramp', slug: 'ramp', atsProvider: 'greenhouse', atsSlug: 'ramp', website: 'https://ramp.com', countryCode: 'US' },
  { name: 'Mercury', slug: 'mercury', atsProvider: 'greenhouse', atsSlug: 'mercury', website: 'https://mercury.com', countryCode: 'US' },
  { name: 'Robinhood', slug: 'robinhood', atsProvider: 'greenhouse', atsSlug: 'robinhood', website: 'https://robinhood.com', countryCode: 'US' },
  { name: 'Chime', slug: 'chime', atsProvider: 'greenhouse', atsSlug: 'chime', website: 'https://chime.com', countryCode: 'US' },
  { name: 'Affirm', slug: 'affirm', atsProvider: 'greenhouse', atsSlug: 'affirm', website: 'https://affirm.com', countryCode: 'US' },
  { name: 'Wise', slug: 'wise', atsProvider: 'greenhouse', atsSlug: 'wise', website: 'https://wise.com', countryCode: 'GB' },
  { name: 'Revolut', slug: 'revolut', atsProvider: 'greenhouse', atsSlug: 'revolut', website: 'https://revolut.com', countryCode: 'GB' },
  
  // Developer Tools / Infrastructure
  { name: 'Vercel', slug: 'vercel', atsProvider: 'greenhouse', atsSlug: 'vercel', website: 'https://vercel.com', countryCode: 'US' },
  { name: 'Supabase', slug: 'supabase', atsProvider: 'greenhouse', atsSlug: 'supabase', website: 'https://supabase.com', countryCode: 'US' },
  { name: 'PlanetScale', slug: 'planetscale', atsProvider: 'greenhouse', atsSlug: 'planetscale', website: 'https://planetscale.com', countryCode: 'US' },
  { name: 'Neon', slug: 'neon', atsProvider: 'greenhouse', atsSlug: 'neondatabase', website: 'https://neon.tech', countryCode: 'US' },
  { name: 'Railway', slug: 'railway', atsProvider: 'greenhouse', atsSlug: 'railway', website: 'https://railway.app', countryCode: 'US' },
  { name: 'Render', slug: 'render', atsProvider: 'greenhouse', atsSlug: 'render', website: 'https://render.com', countryCode: 'US' },
  { name: 'Cloudflare', slug: 'cloudflare', atsProvider: 'greenhouse', atsSlug: 'cloudflare', website: 'https://cloudflare.com', countryCode: 'US' },
  { name: 'Databricks', slug: 'databricks', atsProvider: 'greenhouse', atsSlug: 'databricks', website: 'https://databricks.com', countryCode: 'US' },
  { name: 'Snowflake', slug: 'snowflake', atsProvider: 'greenhouse', atsSlug: 'snowflake', website: 'https://snowflake.com', countryCode: 'US' },
  { name: 'MongoDB', slug: 'mongodb', atsProvider: 'greenhouse', atsSlug: 'mongodb', website: 'https://mongodb.com', countryCode: 'US' },
  { name: 'Elastic', slug: 'elastic', atsProvider: 'greenhouse', atsSlug: 'elastic', website: 'https://elastic.co', countryCode: 'US' },
  { name: 'HashiCorp', slug: 'hashicorp', atsProvider: 'greenhouse', atsSlug: 'hashicorp', website: 'https://hashicorp.com', countryCode: 'US' },
  { name: 'GitLab', slug: 'gitlab', atsProvider: 'greenhouse', atsSlug: 'gitlab', website: 'https://gitlab.com', countryCode: 'US' },
  { name: 'Retool', slug: 'retool', atsProvider: 'greenhouse', atsSlug: 'retool', website: 'https://retool.com', countryCode: 'US' },
  { name: 'Figma', slug: 'figma', atsProvider: 'greenhouse', atsSlug: 'figma', website: 'https://figma.com', countryCode: 'US' },
  { name: 'Webflow', slug: 'webflow', atsProvider: 'greenhouse', atsSlug: 'webflow', website: 'https://webflow.com', countryCode: 'US' },
  { name: 'Dbt Labs', slug: 'dbt-labs', atsProvider: 'greenhouse', atsSlug: 'dbtlabsinc', website: 'https://getdbt.com', countryCode: 'US' },
  { name: 'Fivetran', slug: 'fivetran', atsProvider: 'greenhouse', atsSlug: 'fivetran', website: 'https://fivetran.com', countryCode: 'US' },
  { name: 'Hex', slug: 'hex', atsProvider: 'greenhouse', atsSlug: 'hex', website: 'https://hex.tech', countryCode: 'US' },
  { name: 'Sentry', slug: 'sentry', atsProvider: 'greenhouse', atsSlug: 'sentry', website: 'https://sentry.io', countryCode: 'US' },
  
  // Consumer / Social
  { name: 'Airbnb', slug: 'airbnb', atsProvider: 'greenhouse', atsSlug: 'airbnb', website: 'https://airbnb.com', countryCode: 'US' },
  { name: 'Discord', slug: 'discord', atsProvider: 'greenhouse', atsSlug: 'discord', website: 'https://discord.com', countryCode: 'US' },
  { name: 'Reddit', slug: 'reddit', atsProvider: 'greenhouse', atsSlug: 'reddit', website: 'https://reddit.com', countryCode: 'US' },
  { name: 'Pinterest', slug: 'pinterest', atsProvider: 'greenhouse', atsSlug: 'pinterest', website: 'https://pinterest.com', countryCode: 'US' },
  { name: 'Spotify', slug: 'spotify', atsProvider: 'greenhouse', atsSlug: 'spotify', website: 'https://spotify.com', countryCode: 'SE' },
  { name: 'Notion', slug: 'notion', atsProvider: 'greenhouse', atsSlug: 'notion', website: 'https://notion.so', countryCode: 'US' },
  { name: 'Airtable', slug: 'airtable', atsProvider: 'greenhouse', atsSlug: 'airtable', website: 'https://airtable.com', countryCode: 'US' },
  { name: 'Zapier', slug: 'zapier', atsProvider: 'greenhouse', atsSlug: 'zapier', website: 'https://zapier.com', countryCode: 'US' },
  { name: 'Instacart', slug: 'instacart', atsProvider: 'greenhouse', atsSlug: 'instacart', website: 'https://instacart.com', countryCode: 'US' },
  { name: 'DoorDash', slug: 'doordash', atsProvider: 'greenhouse', atsSlug: 'doordash', website: 'https://doordash.com', countryCode: 'US' },
  { name: 'Uber', slug: 'uber', atsProvider: 'greenhouse', atsSlug: 'uber', website: 'https://uber.com', countryCode: 'US' },
  { name: 'Lyft', slug: 'lyft', atsProvider: 'greenhouse', atsSlug: 'lyft', website: 'https://lyft.com', countryCode: 'US' },
  
  // SaaS / Enterprise
  { name: 'Rippling', slug: 'rippling', atsProvider: 'greenhouse', atsSlug: 'rippling', website: 'https://rippling.com', countryCode: 'US' },
  { name: 'Gusto', slug: 'gusto', atsProvider: 'greenhouse', atsSlug: 'gusto', website: 'https://gusto.com', countryCode: 'US' },
  { name: 'Deel', slug: 'deel', atsProvider: 'greenhouse', atsSlug: 'deel', website: 'https://deel.com', countryCode: 'US' },
  { name: 'Remote', slug: 'remote-com', atsProvider: 'greenhouse', atsSlug: 'remotecom', website: 'https://remote.com', countryCode: 'US' },
  { name: 'Amplitude', slug: 'amplitude', atsProvider: 'greenhouse', atsSlug: 'amplitude', website: 'https://amplitude.com', countryCode: 'US' },
  { name: 'Mixpanel', slug: 'mixpanel', atsProvider: 'greenhouse', atsSlug: 'mixpanel', website: 'https://mixpanel.com', countryCode: 'US' },
  { name: 'Intercom', slug: 'intercom', atsProvider: 'greenhouse', atsSlug: 'intercom', website: 'https://intercom.com', countryCode: 'US' },
  { name: 'Zendesk', slug: 'zendesk', atsProvider: 'greenhouse', atsSlug: 'zendesk', website: 'https://zendesk.com', countryCode: 'US' },
  { name: 'HubSpot', slug: 'hubspot', atsProvider: 'greenhouse', atsSlug: 'hubspot', website: 'https://hubspot.com', countryCode: 'US' },
  
  // Security
  { name: 'Samsara', slug: 'samsara', atsProvider: 'greenhouse', atsSlug: 'samsara', website: 'https://samsara.com', countryCode: 'US' },
  { name: '1Password', slug: '1password', atsProvider: 'ashby', atsSlug: '1password', website: 'https://1password.com/jobs/', countryCode: 'CA' },
  { name: 'Verkada', slug: 'verkada', atsProvider: 'greenhouse', atsSlug: 'verkada', website: 'https://verkada.com', countryCode: 'US' },
  { name: 'CrowdStrike', slug: 'crowdstrike', atsProvider: 'greenhouse', atsSlug: 'crowdstrike', website: 'https://crowdstrike.com', countryCode: 'US' },
  { name: 'Datadog', slug: 'datadog', atsProvider: 'greenhouse', atsSlug: 'datadog', website: 'https://datadoghq.com', countryCode: 'US' },
  { name: 'Snyk', slug: 'snyk', atsProvider: 'greenhouse', atsSlug: 'snyk', website: 'https://snyk.io', countryCode: 'US' },
  
  // Aerospace / Defense
  { name: 'SpaceX', slug: 'spacex', atsProvider: 'greenhouse', atsSlug: 'spacex', website: 'https://spacex.com', countryCode: 'US' },
  { name: 'Anduril', slug: 'anduril', atsProvider: 'greenhouse', atsSlug: 'andurilindustries', website: 'https://anduril.com', countryCode: 'US' },
  { name: 'Relativity Space', slug: 'relativity-space', atsProvider: 'greenhouse', atsSlug: 'relativityspace', website: 'https://relativityspace.com', countryCode: 'US' },
  { name: 'Planet Labs', slug: 'planet-labs', atsProvider: 'greenhouse', atsSlug: 'planetlabs', website: 'https://planet.com', countryCode: 'US' },
  
  // Health / Biotech
  { name: 'Ro', slug: 'ro', atsProvider: 'greenhouse', atsSlug: 'ro', website: 'https://ro.co', countryCode: 'US' },
]

// ============================================================================
// LEVER COMPANIES (validated current slugs only)
// ============================================================================
const LEVER_COMPANIES: CompanySeed[] = [
  { name: 'Palantir', slug: 'palantir', atsProvider: 'lever', atsSlug: 'palantir', website: 'https://palantir.com', countryCode: 'US' },
]

// ============================================================================
// ASHBY COMPANIES (20+)
// ============================================================================
const ASHBY_COMPANIES: CompanySeed[] = [
  { name: 'Faire', slug: 'faire', atsProvider: 'ashby', atsSlug: 'faire', website: 'https://faire.com', countryCode: 'US' },
  { name: 'Coda', slug: 'coda', atsProvider: 'ashby', atsSlug: 'coda', website: 'https://coda.io', countryCode: 'US' },
  { name: 'Vanta', slug: 'vanta', atsProvider: 'ashby', atsSlug: 'vanta', website: 'https://vanta.com', countryCode: 'US' },
  { name: 'Linear', slug: 'linear', atsProvider: 'ashby', atsSlug: 'linear', website: 'https://linear.app/careers', countryCode: 'US' },
  { name: 'Stytch', slug: 'stytch', atsProvider: 'ashby', atsSlug: 'stytch', website: 'https://stytch.com', countryCode: 'US' },
  { name: 'Sourcegraph', slug: 'sourcegraph', atsProvider: 'ashby', atsSlug: 'sourcegraph', website: 'https://sourcegraph.com', countryCode: 'US' },
  { name: 'Cockroach Labs', slug: 'cockroach-labs', atsProvider: 'ashby', atsSlug: 'cockroachlabs', website: 'https://cockroachlabs.com', countryCode: 'US' },
  { name: 'Airbyte', slug: 'airbyte', atsProvider: 'ashby', atsSlug: 'airbyte', website: 'https://airbyte.com', countryCode: 'US' },
  { name: 'Ashby', slug: 'ashby', atsProvider: 'ashby', atsSlug: 'ashby', website: 'https://ashbyhq.com', countryCode: 'US' },
  { name: 'Resend', slug: 'resend', atsProvider: 'ashby', atsSlug: 'resend', website: 'https://resend.com', countryCode: 'US' },
  { name: 'Raycast', slug: 'raycast', atsProvider: 'ashby', atsSlug: 'raycast', website: 'https://raycast.com', countryCode: 'DE' },
  { name: 'Cursor', slug: 'cursor', atsProvider: 'ashby', atsSlug: 'anysphere', website: 'https://cursor.sh', countryCode: 'US' },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getAtsUrl(provider: string, slug: string): string {
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

function extractAtsSlug(provider: string | null | undefined, atsUrl: string | null | undefined): string | null {
  if (!provider || !atsUrl) return null

  try {
    const url = new URL(atsUrl)
    const parts = url.pathname.split('/').filter(Boolean)

    switch (provider) {
      case 'greenhouse': {
        const forParam = url.searchParams.get('for')
        if (forParam) return forParam
        return parts[0] ?? null
      }
      case 'lever':
      case 'ashby':
      case 'smartrecruiters':
        return parts[0] ?? null
      case 'recruitee':
        return url.hostname.replace(/\.recruitee\.com$/i, '')
      default:
        return null
    }
  } catch {
    return null
  }
}

function shouldReplaceWebsite(currentWebsite: string | null | undefined): boolean {
  if (!currentWebsite) return true

  try {
    const hostname = new URL(currentWebsite).hostname.toLowerCase()
    return (
      hostname === 'boards.greenhouse.io' ||
      hostname === 'job-boards.greenhouse.io' ||
      hostname === 'jobs.lever.co' ||
      hostname === 'jobs.smartrecruiters.com' ||
      hostname === 'careers.smartrecruiters.com' ||
      hostname === 'apply.workable.com' ||
      hostname.endsWith('.recruitee.com') ||
      hostname.endsWith('.bamboohr.com') ||
      hostname.endsWith('.myworkdayjobs.com') ||
      hostname.endsWith('.breezy.hr')
    )
  } catch {
    return true
  }
}

async function findExistingCompany(company: CompanySeed, atsUrl: string) {
  const bySlug = await prisma.company.findUnique({
    where: { slug: company.slug },
  })
  if (bySlug) return bySlug

  const byName = await prisma.company.findFirst({
    where: {
      name: {
        equals: company.name,
        mode: 'insensitive',
      },
    },
  })
  if (byName) return byName

  const byExactAtsUrl = await prisma.company.findFirst({
    where: { atsUrl },
  })
  if (byExactAtsUrl) return byExactAtsUrl

  const providerMatches = await prisma.company.findMany({
    where: {
      atsProvider: company.atsProvider,
      atsUrl: { not: null },
    },
  })

  return (
    providerMatches.find(
      (candidate) => extractAtsSlug(candidate.atsProvider, candidate.atsUrl) === company.atsSlug,
    ) ?? null
  )
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  __slog('=== Seeding Top Companies ===')
  __slog('')

  const allCompanies = [
    ...GREENHOUSE_COMPANIES,
    ...LEVER_COMPANIES,
    ...ASHBY_COMPANIES,
  ]

  let created = 0
  let updated = 0
  let skipped = 0

  for (const company of allCompanies) {
    const atsUrl = getAtsUrl(company.atsProvider, company.atsSlug)

    try {
      const existing = await findExistingCompany(company, atsUrl)

      if (existing) {
        const nextData: Record<string, string | null | undefined> = {}

        if (existing.atsProvider !== company.atsProvider) {
          nextData.atsProvider = company.atsProvider
        }
        if (existing.atsUrl !== atsUrl) {
          nextData.atsUrl = atsUrl
        }
        if (existing.atsSlug !== company.atsSlug) {
          nextData.atsSlug = company.atsSlug
        }
        if (company.website && shouldReplaceWebsite(existing.website)) {
          nextData.website = company.website
        }
        if (company.countryCode && !existing.countryCode) {
          nextData.countryCode = company.countryCode
        }

        if (Object.keys(nextData).length > 0) {
          await prisma.company.update({
            where: { id: existing.id },
            data: nextData,
          })
          __slog('✓ Updated: ' + company.name + ' (' + company.atsProvider + ')')
          updated++
        } else {
          skipped++
        }
      } else {
        await prisma.company.create({
          data: {
            name: company.name,
            slug: company.slug,
            website: company.website || null,
            atsProvider: company.atsProvider,
            atsUrl: atsUrl,
            atsSlug: company.atsSlug,
            countryCode: company.countryCode || null,
          },
        })
        __slog('+ Created: ' + company.name + ' (' + company.atsProvider + ')')
        created++
      }
    } catch (err: any) {
      if (err?.code === 'P2002') {
        skipped++
      } else {
        __serr('✗ Error with ' + company.name + ':', err?.message)
        skipped++
      }
    }
  }

  // Final stats
  const totalCompanies = await prisma.company.count()
  const withAts = await prisma.company.count({
    where: { 
      atsProvider: { not: null }, 
      atsUrl: { not: null },
      atsSlug: { not: null },
    },
  })

  __slog('')
  __slog('=== Seed Complete ===')
  __slog('Created: ' + created)
  __slog('Updated: ' + updated)
  __slog('Skipped: ' + skipped)
  __slog('')
  __slog('Total companies in DB: ' + totalCompanies)
  __slog('Companies with ATS: ' + withAts)
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
  
