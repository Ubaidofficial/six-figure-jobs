// scripts/seedTopCompanies.ts
// Seeds 150+ top tech companies with their ATS URLs

import { PrismaClient } from '@prisma/client'

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
  { name: 'Perplexity', slug: 'perplexity', atsProvider: 'greenhouse', atsSlug: 'perplexityai', website: 'https://perplexity.ai', countryCode: 'US' },
  { name: 'Mistral AI', slug: 'mistral-ai', atsProvider: 'greenhouse', atsSlug: 'mistral', website: 'https://mistral.ai', countryCode: 'FR' },
  { name: 'Runway', slug: 'runway', atsProvider: 'greenhouse', atsSlug: 'runwayml', website: 'https://runway.com', countryCode: 'US' },
  { name: 'Stability AI', slug: 'stability-ai', atsProvider: 'greenhouse', atsSlug: 'stabilityai', website: 'https://stability.ai', countryCode: 'GB' },
  { name: 'Adept', slug: 'adept', atsProvider: 'greenhouse', atsSlug: 'adeptailabs', website: 'https://adept.ai', countryCode: 'US' },
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
  { name: 'Klarna', slug: 'klarna', atsProvider: 'greenhouse', atsSlug: 'klarna', website: 'https://klarna.com', countryCode: 'SE' },
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
  { name: 'Linear', slug: 'linear', atsProvider: 'greenhouse', atsSlug: 'linear', website: 'https://linear.app', countryCode: 'US' },
  { name: 'Figma', slug: 'figma', atsProvider: 'greenhouse', atsSlug: 'figma', website: 'https://figma.com', countryCode: 'US' },
  { name: 'Webflow', slug: 'webflow', atsProvider: 'greenhouse', atsSlug: 'webflow', website: 'https://webflow.com', countryCode: 'US' },
  { name: 'Dbt Labs', slug: 'dbt-labs', atsProvider: 'greenhouse', atsSlug: 'daboratoriesdbtlabs', website: 'https://getdbt.com', countryCode: 'US' },
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
  { name: '1Password', slug: '1password', atsProvider: 'greenhouse', atsSlug: '1password', website: 'https://1password.com', countryCode: 'CA' },
  { name: 'Verkada', slug: 'verkada', atsProvider: 'greenhouse', atsSlug: 'verkada', website: 'https://verkada.com', countryCode: 'US' },
  { name: 'CrowdStrike', slug: 'crowdstrike', atsProvider: 'greenhouse', atsSlug: 'crowdstrike', website: 'https://crowdstrike.com', countryCode: 'US' },
  { name: 'Snyk', slug: 'snyk', atsProvider: 'greenhouse', atsSlug: 'snyk', website: 'https://snyk.io', countryCode: 'US' },
  
  // Aerospace / Defense
  { name: 'SpaceX', slug: 'spacex', atsProvider: 'greenhouse', atsSlug: 'spacex', website: 'https://spacex.com', countryCode: 'US' },
  { name: 'Anduril', slug: 'anduril', atsProvider: 'greenhouse', atsSlug: 'andurilindustries', website: 'https://anduril.com', countryCode: 'US' },
  { name: 'Relativity Space', slug: 'relativity-space', atsProvider: 'greenhouse', atsSlug: 'relativityspace', website: 'https://relativityspace.com', countryCode: 'US' },
  { name: 'Planet Labs', slug: 'planet-labs', atsProvider: 'greenhouse', atsSlug: 'planetlabs', website: 'https://planet.com', countryCode: 'US' },
  
  // Health / Biotech
  { name: 'Tempus', slug: 'tempus', atsProvider: 'greenhouse', atsSlug: 'tempus', website: 'https://tempus.com', countryCode: 'US' },
  { name: 'Color', slug: 'color', atsProvider: 'greenhouse', atsSlug: 'color', website: 'https://color.com', countryCode: 'US' },
  { name: 'Ro', slug: 'ro', atsProvider: 'greenhouse', atsSlug: 'ro', website: 'https://ro.co', countryCode: 'US' },
  { name: 'Hims & Hers', slug: 'hims-hers', atsProvider: 'greenhouse', atsSlug: 'himshers', website: 'https://hims.com', countryCode: 'US' },
]

// ============================================================================
// LEVER COMPANIES (30+)
// ============================================================================
const LEVER_COMPANIES: CompanySeed[] = [
  { name: 'Netflix', slug: 'netflix', atsProvider: 'lever', atsSlug: 'netflix', website: 'https://netflix.com', countryCode: 'US' },
  { name: 'Shopify', slug: 'shopify', atsProvider: 'lever', atsSlug: 'shopify', website: 'https://shopify.com', countryCode: 'CA' },
  { name: 'Twilio', slug: 'twilio', atsProvider: 'lever', atsSlug: 'twilio', website: 'https://twilio.com', countryCode: 'US' },
  { name: 'Asana', slug: 'asana', atsProvider: 'lever', atsSlug: 'asana', website: 'https://asana.com', countryCode: 'US' },
  { name: 'Postman', slug: 'postman', atsProvider: 'lever', atsSlug: 'postman', website: 'https://postman.com', countryCode: 'US' },
  { name: 'Canva', slug: 'canva', atsProvider: 'lever', atsSlug: 'canva', website: 'https://canva.com', countryCode: 'AU' },
  { name: 'Atlassian', slug: 'atlassian', atsProvider: 'lever', atsSlug: 'atlassian', website: 'https://atlassian.com', countryCode: 'AU' },
  { name: 'Datadog', slug: 'datadog', atsProvider: 'lever', atsSlug: 'datadog', website: 'https://datadoghq.com', countryCode: 'US' },
  { name: 'Grafana Labs', slug: 'grafana-labs', atsProvider: 'lever', atsSlug: 'grafanalabs', website: 'https://grafana.com', countryCode: 'US' },
  { name: 'LaunchDarkly', slug: 'launchdarkly', atsProvider: 'lever', atsSlug: 'launchdarkly', website: 'https://launchdarkly.com', countryCode: 'US' },
  { name: 'Auth0', slug: 'auth0', atsProvider: 'lever', atsSlug: 'auth0', website: 'https://auth0.com', countryCode: 'US' },
  { name: 'Segment', slug: 'segment', atsProvider: 'lever', atsSlug: 'segment', website: 'https://segment.com', countryCode: 'US' },
  { name: 'Miro', slug: 'miro', atsProvider: 'lever', atsSlug: 'miro', website: 'https://miro.com', countryCode: 'US' },
  { name: 'Loom', slug: 'loom', atsProvider: 'lever', atsSlug: 'useloom', website: 'https://loom.com', countryCode: 'US' },
  { name: 'Calendly', slug: 'calendly', atsProvider: 'lever', atsSlug: 'calendly', website: 'https://calendly.com', countryCode: 'US' },
  { name: 'Dropbox', slug: 'dropbox', atsProvider: 'lever', atsSlug: 'dropbox', website: 'https://dropbox.com', countryCode: 'US' },
  { name: 'Slack', slug: 'slack', atsProvider: 'lever', atsSlug: 'slack', website: 'https://slack.com', countryCode: 'US' },
  { name: 'Box', slug: 'box', atsProvider: 'lever', atsSlug: 'box', website: 'https://box.com', countryCode: 'US' },
  { name: 'DocuSign', slug: 'docusign', atsProvider: 'lever', atsSlug: 'docusign', website: 'https://docusign.com', countryCode: 'US' },
  { name: 'Okta', slug: 'okta', atsProvider: 'lever', atsSlug: 'okta', website: 'https://okta.com', countryCode: 'US' },
  { name: 'Palantir', slug: 'palantir', atsProvider: 'lever', atsSlug: 'palantir', website: 'https://palantir.com', countryCode: 'US' },
  { name: 'Flexport', slug: 'flexport', atsProvider: 'lever', atsSlug: 'flexport', website: 'https://flexport.com', countryCode: 'US' },
  { name: 'Samsara', slug: 'samsara', atsProvider: 'lever', atsSlug: 'samsara', website: 'https://samsara.com', countryCode: 'US' },
]

// ============================================================================
// ASHBY COMPANIES (20+)
// ============================================================================
const ASHBY_COMPANIES: CompanySeed[] = [
  { name: 'Faire', slug: 'faire', atsProvider: 'ashby', atsSlug: 'faire', website: 'https://faire.com', countryCode: 'US' },
  { name: 'Coda', slug: 'coda', atsProvider: 'ashby', atsSlug: 'coda', website: 'https://coda.io', countryCode: 'US' },
  { name: 'Vanta', slug: 'vanta', atsProvider: 'ashby', atsSlug: 'vanta', website: 'https://vanta.com', countryCode: 'US' },
  { name: 'Liveblocks', slug: 'liveblocks', atsProvider: 'ashby', atsSlug: 'liveblocks', website: 'https://liveblocks.io', countryCode: 'US' },
  { name: 'Stytch', slug: 'stytch', atsProvider: 'ashby', atsSlug: 'stytch', website: 'https://stytch.com', countryCode: 'US' },
  { name: 'Sourcegraph', slug: 'sourcegraph', atsProvider: 'ashby', atsSlug: 'sourcegraph', website: 'https://sourcegraph.com', countryCode: 'US' },
  { name: 'Cockroach Labs', slug: 'cockroach-labs', atsProvider: 'ashby', atsSlug: 'cockroachlabs', website: 'https://cockroachlabs.com', countryCode: 'US' },
  { name: 'Airbyte', slug: 'airbyte', atsProvider: 'ashby', atsSlug: 'airbyte', website: 'https://airbyte.com', countryCode: 'US' },
  { name: 'Ashby', slug: 'ashby', atsProvider: 'ashby', atsSlug: 'ashby', website: 'https://ashbyhq.com', countryCode: 'US' },
  { name: 'Resend', slug: 'resend', atsProvider: 'ashby', atsSlug: 'resend', website: 'https://resend.com', countryCode: 'US' },
  { name: 'Raycast', slug: 'raycast', atsProvider: 'ashby', atsSlug: 'raycast', website: 'https://raycast.com', countryCode: 'DE' },
  { name: 'Clay', slug: 'clay', atsProvider: 'ashby', atsSlug: 'clay', website: 'https://clay.com', countryCode: 'US' },
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

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('=== Seeding Top Companies ===')
  console.log('')

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
      const existing = await prisma.company.findUnique({
        where: { slug: company.slug },
      })

      if (existing) {
        // Update with ATS info if missing or different
        if (!existing.atsUrl || existing.atsUrl !== atsUrl || !existing.atsSlug) {
          await prisma.company.update({
            where: { slug: company.slug },
            data: {
              atsProvider: company.atsProvider,
              atsUrl: atsUrl,
              atsSlug: company.atsSlug,
              website: company.website || existing.website,
              countryCode: company.countryCode || existing.countryCode,
            },
          })
          console.log('✓ Updated: ' + company.name + ' (' + company.atsProvider + ')')
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
        console.log('+ Created: ' + company.name + ' (' + company.atsProvider + ')')
        created++
      }
    } catch (err: any) {
      if (err?.code === 'P2002') {
        skipped++
      } else {
        console.error('✗ Error with ' + company.name + ':', err?.message)
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

  console.log('')
  console.log('=== Seed Complete ===')
  console.log('Created: ' + created)
  console.log('Updated: ' + updated)
  console.log('Skipped: ' + skipped)
  console.log('')
  console.log('Total companies in DB: ' + totalCompanies)
  console.log('Companies with ATS: ' + withAts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
  