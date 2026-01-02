import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import slugify from 'slugify'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

const REMOTE_COMPANIES = [
  { name: 'Stripe', atsUrl: 'https://boards.greenhouse.io/stripe' },
  { name: 'Shopify', atsUrl: 'https://boards.greenhouse.io/shopify' },
  { name: 'Twilio', atsUrl: 'https://boards.greenhouse.io/twilio' },
  { name: 'Figma', atsUrl: 'https://boards.greenhouse.io/figma' },
  { name: 'Notion', atsUrl: 'https://boards.greenhouse.io/notion' },
  { name: 'Linear', atsUrl: 'https://boards.greenhouse.io/linear' },
  { name: 'Vercel', atsUrl: 'https://boards.greenhouse.io/vercel' },
  { name: 'Supabase', atsUrl: 'https://boards.greenhouse.io/supabase' },
  { name: 'PlanetScale', atsUrl: 'https://boards.greenhouse.io/planetscale' },
  { name: 'GitLab', atsUrl: 'https://boards.greenhouse.io/gitlab' },
  { name: 'Zapier', atsUrl: 'https://boards.greenhouse.io/zapier' },
  { name: 'Webflow', atsUrl: 'https://boards.greenhouse.io/webflow' },
  { name: 'Loom', atsUrl: 'https://boards.greenhouse.io/loom' },
  { name: 'Miro', atsUrl: 'https://boards.greenhouse.io/miro' },
  { name: 'Deel', atsUrl: 'https://boards.greenhouse.io/deel' },
  { name: 'Oyster', atsUrl: 'https://boards.greenhouse.io/oysterhr' },
  { name: 'Doist', atsUrl: 'https://boards.greenhouse.io/doist' },
  { name: 'OpenAI', atsUrl: 'https://boards.greenhouse.io/openai' },
  { name: 'Cohere', atsUrl: 'https://boards.greenhouse.io/cohere' },
  { name: 'Hugging Face', atsUrl: 'https://boards.greenhouse.io/huggingface' },
  { name: 'Scale AI', atsUrl: 'https://boards.greenhouse.io/scaleai' },
  { name: 'Plaid', atsUrl: 'https://boards.greenhouse.io/plaid' },
  { name: 'Ramp', atsUrl: 'https://boards.greenhouse.io/ramp' },
  { name: 'Mercury', atsUrl: 'https://boards.greenhouse.io/mercury' },
  { name: 'HashiCorp', atsUrl: 'https://boards.greenhouse.io/hashicorp' },
  { name: 'Postman', atsUrl: 'https://boards.greenhouse.io/postman' },
  { name: 'Sourcegraph', atsUrl: 'https://boards.greenhouse.io/sourcegraph' },
  { name: 'LaunchDarkly', atsUrl: 'https://boards.greenhouse.io/launchdarkly' },
  { name: 'Snyk', atsUrl: 'https://boards.greenhouse.io/snyk' },
  { name: 'Cockroach Labs', atsUrl: 'https://boards.greenhouse.io/cockroachlabs' },
  { name: 'Temporal', atsUrl: 'https://boards.greenhouse.io/temporal' },
  { name: 'Grafana Labs', atsUrl: 'https://boards.greenhouse.io/grafanalabs' },
  { name: 'Kong', atsUrl: 'https://boards.greenhouse.io/kong' },
  { name: 'Pulumi', atsUrl: 'https://boards.greenhouse.io/pulumi' },
  { name: 'Retool', atsUrl: 'https://boards.greenhouse.io/retool' },
  { name: 'Render', atsUrl: 'https://boards.greenhouse.io/render' },
  { name: 'Netflix', atsUrl: 'https://jobs.lever.co/netflix' },
  { name: 'Spotify', atsUrl: 'https://www.lifeatspotify.com/jobs' },
  { name: 'Lyft', atsUrl: 'https://www.lyft.com/careers' },
]

async function main() {
  __slog('Checking for missing companies...\n')

  let added = 0
  let existing = 0

  for (const company of REMOTE_COMPANIES) {
    const slug = slugify(company.name, { lower: true, strict: true })
    
    const exists = await prisma.company.findUnique({ where: { slug } })
    
    if (exists) {
      existing++
      continue
    }

    // Add company
    await prisma.company.create({
      data: {
        name: company.name,
        slug,
        atsUrl: company.atsUrl,
        logoUrl: `https://logo.clearbit.com/${slug}.com`,
      }
    })
    __slog(`  Added: ${company.name}`)
    added++
  }

  __slog(`\nDone: ${added} added, ${existing} already existed`)
  await prisma.$disconnect()
}

main()
