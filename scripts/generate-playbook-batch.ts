import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { TIER_1_ROLES } from '../lib/roles/canonicalSlugs'
import { SKILL_TARGETS, INDUSTRY_TARGETS, CITY_TARGETS } from '../lib/seo/pseoTargets'
import { TARGET_COUNTRIES } from '../lib/seo/regions'
import { countryCodeToSlug } from '../lib/seo/countrySlug'
import {
  generatePlaybookBatch,
  type RawPlaybookDataset,
} from '../lib/seo/playbookBatchGenerator'

type CliOptions = {
  input?: string
  output?: string
  batchSize: number
  batchNumber: number
  siteBaseUrl?: string
}

function titleCaseFromSlug(value: string): string {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    batchSize: 100,
    batchNumber: 1,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--input' && next) {
      options.input = next
      i++
      continue
    }
    if (arg === '--output' && next) {
      options.output = next
      i++
      continue
    }
    if (arg === '--batch-size' && next) {
      const parsed = Number(next)
      if (Number.isFinite(parsed) && parsed > 0) {
        options.batchSize = Math.floor(parsed)
      }
      i++
      continue
    }
    if (arg === '--batch-number' && next) {
      const parsed = Number(next)
      if (Number.isFinite(parsed) && parsed > 0) {
        options.batchNumber = Math.floor(parsed)
      }
      i++
      continue
    }
    if (arg === '--site-base-url' && next) {
      options.siteBaseUrl = next
      i++
      continue
    }
  }

  return options
}

function fallbackLocationInsights(code?: string): {
  pricing: string
  regulation: string
  trend: string
  recommendation: string
} {
  const normalized = (code || '').toUpperCase()
  if (normalized === 'US') {
    return {
      pricing:
        'Senior compensation varies significantly by state and metro, with strong premiums for security, platform, and AI roles.',
      regulation:
        'Pay transparency and salary-range disclosure laws in multiple states make explicit compensation metadata mandatory.',
      trend:
        'Hybrid and remote patterns remain common for staff-level and principal-level roles.',
      recommendation:
        'Map location pages to state-level salary guidance to maintain high-intent relevance.',
    }
  }
  if (normalized === 'CA') {
    return {
      pricing:
        'Compensation is often benchmarked separately for Toronto, Vancouver, and national remote bands.',
      regulation:
        'Provincial labor and disclosure expectations should be reflected in compensation content.',
      trend:
        'Data and AI hiring remains competitive with strong cross-border pressure on salaries.',
      recommendation:
        'Show CAD salary context and province-aware language to improve trust and relevance.',
    }
  }
  if (normalized === 'GB') {
    return {
      pricing:
        'London and national bands can diverge substantially, especially for senior engineering leadership roles.',
      regulation:
        'Right-to-work constraints and role-location policies frequently shape remote eligibility.',
      trend:
        'Platform, security, and technical management hiring remain active in hybrid structures.',
      recommendation:
        'Clarify location eligibility and compensation assumptions early in page copy.',
    }
  }

  return {
    pricing:
      'Local compensation should be anchored to role scope and verified market ranges rather than generic global assumptions.',
    regulation:
      'Regional employment and privacy requirements should be reflected in page-level compliance notes.',
    trend:
      'Demand patterns vary by role family; updates should track observable hiring shifts.',
    recommendation:
      'Use location-aware salary and eligibility details to keep the page useful for high-intent users.',
  }
}

function buildDefaultDataset(): RawPlaybookDataset {
  const categories = TIER_1_ROLES.slice(0, 16).map((slug) => ({
    slug,
    label: titleCaseFromSlug(slug),
  }))

  const tools = SKILL_TARGETS.slice(0, 14).map((skill) => ({
    slug: skill.slug,
    label: skill.label,
  }))

  const locationsFromCountries = TARGET_COUNTRIES.slice(0, 8).map((country) => {
    const slug = countryCodeToSlug(country.code) || country.code.toLowerCase()
    const insights = fallbackLocationInsights(country.code)
    return {
      slug,
      label: country.label,
      country_code: country.code,
      pricing_insight: insights.pricing,
      regulation_insight: insights.regulation,
      trend_insight: insights.trend,
      local_recommendation: insights.recommendation,
    }
  })

  const locationsFromCities = CITY_TARGETS.slice(0, 6).map((city) => {
    const insights = fallbackLocationInsights(city.countryCode)
    return {
      slug: city.slug,
      label: city.label,
      country_code: city.countryCode,
      pricing_insight: insights.pricing,
      regulation_insight: insights.regulation,
      trend_insight: insights.trend,
      local_recommendation: insights.recommendation,
    }
  })

  return {
    categories,
    subcategories: [
      { slug: 'platform', label: 'Platform' },
      { slug: 'frontend', label: 'Frontend' },
      { slug: 'backend', label: 'Backend' },
      { slug: 'data', label: 'Data' },
      { slug: 'security', label: 'Security' },
      { slug: 'product', label: 'Product' },
    ],
    tools,
    products: tools.slice(0, 8),
    locations: [...locationsFromCountries, ...locationsFromCities],
    personas: [
      {
        slug: 'recruiter',
        label: 'Recruiter',
        pain_points: [
          'slow shortlist quality for senior candidates',
          'inconsistent interview notes across panel members',
          'salary misalignment discovered too late in process',
        ],
        benefits: [
          'faster high-signal screening',
          'cleaner recruiter-to-manager handoffs',
          'stronger offer acceptance outcomes',
        ],
        use_cases: ['pipeline calibration', 'panel workflows', 'offer planning'],
      },
      {
        slug: 'hiring-manager',
        label: 'Hiring Manager',
        pain_points: [
          'unclear role-scope alignment in final interviews',
          'difficulty comparing high-level candidates consistently',
          'limited visibility into compensation risk',
        ],
        benefits: [
          'repeatable evaluation standards',
          'better level-to-scope matching',
          'reduced late-stage candidate drop-off',
        ],
        use_cases: ['role scoring', 'debrief quality', 'close strategy'],
      },
      {
        slug: 'candidate',
        label: 'Candidate',
        pain_points: [
          'generic applications underperform in competitive pipelines',
          'uncertain compensation expectations',
          'difficulty prioritizing best-fit opportunities',
        ],
        benefits: [
          'better application targeting',
          'higher interview conversion',
          'improved negotiation preparation',
        ],
        use_cases: ['resume strategy', 'role targeting', 'salary negotiation'],
      },
      {
        slug: 'founder',
        label: 'Founder',
        pain_points: [
          'limited hiring bandwidth for senior roles',
          'inconsistent process design across teams',
          'difficulty balancing speed and quality',
        ],
        benefits: [
          'clear hiring operating model',
          'predictable process throughput',
          'stronger leadership hiring outcomes',
        ],
        use_cases: ['early-stage hiring system', 'interview architecture', 'compensation guardrails'],
      },
      {
        slug: 'vp-engineering',
        label: 'VP Engineering',
        pain_points: [
          'inconsistent leveling decisions',
          'panel drift from defined scorecards',
          'offer strategy misaligned with market data',
        ],
        benefits: [
          'aligned hiring governance',
          'higher close rates for principal talent',
          'scalable process consistency',
        ],
        use_cases: ['headcount planning', 'panel standards', 'offer governance'],
      },
    ],
    file_formats: [
      { slug: 'google-docs', label: 'Google Docs' },
      { slug: 'notion', label: 'Notion' },
      { slug: 'markdown', label: 'Markdown' },
      { slug: 'pdf', label: 'PDF' },
      { slug: 'csv', label: 'CSV' },
      { slug: 'airtable', label: 'Airtable' },
    ],
    industries: INDUSTRY_TARGETS.slice(0, 8).map((industry) => ({
      slug: industry.slug,
      label: industry.label,
    })),
    languages: [
      {
        slug: 'english',
        label: 'English',
        native_name: 'English',
        locale: 'en-US',
        hreflang: 'en-us',
        cultural_note:
          'Keep language concise, emphasize clarity on compensation and role scope, and use direct action framing.',
      },
      {
        slug: 'spanish',
        label: 'Spanish',
        native_name: 'Espanol',
        locale: 'es-ES',
        hreflang: 'es-es',
        cultural_note:
          'Prioritize natural phrasing over literal translation and clarify regional salary terminology where meanings differ.',
      },
      {
        slug: 'german',
        label: 'German',
        native_name: 'Deutsch',
        locale: 'de-DE',
        hreflang: 'de-de',
        cultural_note:
          'Maintain precise technical terminology and explicit process detail to support trust in professional contexts.',
      },
      {
        slug: 'french',
        label: 'French',
        native_name: 'Francais',
        locale: 'fr-FR',
        hreflang: 'fr-fr',
        cultural_note:
          'Adapt tone to professional formality expectations and local compensation communication norms.',
      },
      {
        slug: 'portuguese',
        label: 'Portuguese',
        native_name: 'Portugues',
        locale: 'pt-BR',
        hreflang: 'pt-br',
        cultural_note:
          'Clarify role seniority and compensation period language because direct literal terms may vary by region.',
      },
      {
        slug: 'japanese',
        label: 'Japanese',
        native_name: 'Nihongo',
        locale: 'ja-JP',
        hreflang: 'ja-jp',
        cultural_note:
          'Use context-rich localization and culturally appropriate professional tone rather than direct string substitution.',
      },
    ],
    integrations: [
      { slug: 'greenhouse', label: 'Greenhouse' },
      { slug: 'lever', label: 'Lever' },
      { slug: 'workday', label: 'Workday' },
      { slug: 'ashby', label: 'Ashby' },
      { slug: 'zapier', label: 'Zapier' },
      { slug: 'slack', label: 'Slack' },
      { slug: 'hubspot', label: 'HubSpot' },
      { slug: 'segment', label: 'Segment' },
    ],
    use_cases: [
      { slug: 'resume-review', label: 'Resume Review' },
      { slug: 'interview-calibration', label: 'Interview Calibration' },
      { slug: 'salary-benchmarking', label: 'Salary Benchmarking' },
      { slug: 'offer-strategy', label: 'Offer Strategy' },
      { slug: 'pipeline-forecasting', label: 'Pipeline Forecasting' },
      { slug: 'candidate-experience', label: 'Candidate Experience' },
      { slug: 'recruiter-ops', label: 'Recruiter Operations' },
      { slug: 'leadership-hiring', label: 'Leadership Hiring' },
    ],
    glossary_terms: [
      {
        slug: 'applicant-tracking-system',
        label: 'Applicant Tracking System',
        beginner_explanation:
          'An Applicant Tracking System (ATS) is software that helps teams collect, organize, and move candidates through hiring stages.',
        technical_depth:
          'At scale, ATS architecture controls canonical candidate IDs, workflow state transitions, and compliance-safe audit history across recruiters and managers.',
        related_terms: ['candidate pipeline', 'job requisition', 'interview scorecard'],
      },
      {
        slug: 'salary-band',
        label: 'Salary Band',
        beginner_explanation:
          'A salary band is a defined pay range for a role level, used to keep offers consistent and fair.',
        technical_depth:
          'Band design requires level mapping, market benchmarks, and compensation governance rules so offers stay competitive without breaking equity constraints.',
        related_terms: ['compensation benchmark', 'offer package', 'pay transparency'],
      },
      {
        slug: 'canonical-url',
        label: 'Canonical URL',
        beginner_explanation:
          'A canonical URL tells search engines which version of similar pages should be treated as the primary one.',
        technical_depth:
          'Canonicalization is essential in programmatic SEO because overlapping combinations can create duplicate-intent clusters that split ranking signals.',
        related_terms: ['redirect mapping', 'indexability gate', 'keyword cannibalization'],
      },
      {
        slug: 'keyword-cannibalization',
        label: 'Keyword Cannibalization',
        beginner_explanation:
          'Keyword cannibalization happens when multiple pages target the same search intent and compete against each other.',
        technical_depth:
          'Preventing cannibalization requires intent fingerprints, canonical ownership, and strict slug uniqueness checks during page generation.',
        related_terms: ['search intent', 'canonical URL', 'internal linking'],
      },
      {
        slug: 'structured-data',
        label: 'Structured Data',
        beginner_explanation:
          'Structured data is machine-readable markup that helps search engines understand page meaning and context.',
        technical_depth:
          'Schema implementation should align with page purpose and include stable identifiers, content-type specificity, and valid JSON-LD formatting.',
        related_terms: ['json-ld', 'schema.org', 'rich results'],
      },
      {
        slug: 'hreflang',
        label: 'Hreflang',
        beginner_explanation:
          'Hreflang is a technical signal that tells search engines which language and region version of a page should be served.',
        technical_depth:
          'Reliable hreflang requires reciprocal mapping across localized variants, canonical references, and x-default fallback definitions.',
        related_terms: ['localization', 'translation SEO', 'canonical URL'],
      },
    ],
    directory_entries: [
      {
        slug: 'greenhouse',
        label: 'Greenhouse',
        attributes: ['ATS workflow controls', 'reporting depth', 'role template support'],
        tags: ['enterprise-ready', 'hiring-ops', 'pipeline-analytics'],
        category_slug: 'software-engineer',
        location_slug: 'united-states',
      },
      {
        slug: 'lever',
        label: 'Lever',
        attributes: ['candidate relationship features', 'automation rules', 'integration coverage'],
        tags: ['mid-market', 'talent-acquisition', 'workflow-automation'],
        category_slug: 'product-manager',
        location_slug: 'canada',
      },
      {
        slug: 'ashby',
        label: 'Ashby',
        attributes: ['analytics-first workflow', 'structured interview modules', 'cross-team visibility'],
        tags: ['high-growth', 'ops-rigor', 'analytics'],
        category_slug: 'engineering-manager',
        location_slug: 'united-kingdom',
      },
      {
        slug: 'workday',
        label: 'Workday',
        attributes: ['enterprise governance', 'compliance controls', 'global process standardization'],
        tags: ['enterprise', 'compliance', 'global-hiring'],
        category_slug: 'vp-engineering',
        location_slug: 'germany',
      },
      {
        slug: 'zapier',
        label: 'Zapier',
        attributes: ['integration automation', 'low-code workflows', 'rapid deployment'],
        tags: ['automation', 'integration', 'ops-efficiency'],
        category_slug: 'data-engineer',
        location_slug: 'ireland',
      },
      {
        slug: 'slack',
        label: 'Slack',
        attributes: ['notification workflows', 'team collaboration', 'workflow orchestration'],
        tags: ['collaboration', 'alerts', 'recruiting-ops'],
        category_slug: 'technical-program-manager',
        location_slug: 'singapore',
      },
      {
        slug: 'hubspot',
        label: 'HubSpot',
        attributes: ['crm integration', 'pipeline reporting', 'automation playbooks'],
        tags: ['go-to-market', 'reporting', 'automation'],
        category_slug: 'account-executive',
        location_slug: 'australia',
      },
      {
        slug: 'segment',
        label: 'Segment',
        attributes: ['event instrumentation', 'data routing', 'taxonomy governance'],
        tags: ['data-platform', 'events', 'analytics'],
        category_slug: 'analytics-engineer',
        location_slug: 'new-york',
      },
    ],
    profiles: [
      {
        slug: 'greenhouse-profile',
        label: 'Greenhouse',
        category_slug: 'software-engineer',
        verified_facts: [
          'Widely adopted ATS platform in high-growth and enterprise recruiting organizations.',
          'Known for structured interview workflows and centralized hiring data.',
        ],
        milestones: [
          'Expanded from startup recruiting focus into enterprise hiring operations use cases.',
          'Built deeper analytics and governance features to support distributed recruiting teams.',
        ],
        unique_insight:
          'Greenhouse is strongest when organizations enforce structured scorecards and centralized decision governance.',
      },
      {
        slug: 'lever-profile',
        label: 'Lever',
        category_slug: 'product-manager',
        verified_facts: [
          'Combines applicant tracking with candidate relationship management patterns.',
          'Frequently selected by teams balancing inbound process and outbound sourcing needs.',
        ],
        milestones: [
          'Scaled adoption in high-growth recruiting functions needing CRM-like capabilities.',
          'Expanded integration ecosystem to support workflow automation and reporting.',
        ],
        unique_insight:
          'Lever performs best when teams need a unified view of sourcing and interview pipeline execution.',
      },
      {
        slug: 'ashby-profile',
        label: 'Ashby',
        category_slug: 'engineering-manager',
        verified_facts: [
          'Positioned around analytics depth and workflow flexibility for recruiting operations.',
          'Adopted by teams that prioritize reporting quality and process transparency.',
        ],
        milestones: [
          'Introduced integrated scheduling and analytics layers for high-velocity teams.',
          'Expanded enterprise controls while keeping a flexible configuration model.',
        ],
        unique_insight:
          'Ashby is differentiated by analytics-first decision support across recruiter and hiring-manager workflows.',
      },
      {
        slug: 'workday-profile',
        label: 'Workday',
        category_slug: 'vp-engineering',
        verified_facts: [
          'Enterprise platform used for broad HR and recruiting process governance.',
          'Common in organizations requiring strict compliance and standardized workflows.',
        ],
        milestones: [
          'Built broad enterprise adoption across multi-region organizations.',
          'Strengthened configuration and governance controls for regulated workflows.',
        ],
        unique_insight:
          'Workday is strongest when recruiting must align with enterprise-wide governance and compliance systems.',
      },
      {
        slug: 'zapier-profile',
        label: 'Zapier',
        category_slug: 'data-engineer',
        verified_facts: [
          'Automation platform used to connect systems without custom code in many operations contexts.',
          'Supports fast workflow prototyping for teams with limited engineering bandwidth.',
        ],
        milestones: [
          'Scaled integration catalog coverage across popular operational tools.',
          'Improved workflow reliability and visibility features for business-critical automations.',
        ],
        unique_insight:
          'Zapier adds the most value when teams standardize event taxonomies before scaling automation volume.',
      },
      {
        slug: 'slack-profile',
        label: 'Slack',
        category_slug: 'technical-program-manager',
        verified_facts: [
          'Collaboration platform used for operational communication and workflow notifications.',
          'Frequently integrated with recruiting and analytics systems for faster coordination.',
        ],
        milestones: [
          'Expanded from messaging into workflow automation and app orchestration.',
          'Deepened ecosystem integrations for operational alerting and collaboration.',
        ],
        unique_insight:
          'Slack is most effective when notification rules are tightly mapped to decision-critical workflow events.',
      },
      {
        slug: 'hubspot-profile',
        label: 'HubSpot',
        category_slug: 'account-executive',
        verified_facts: [
          'CRM platform widely used for pipeline visibility and automation in revenue teams.',
          'Provides workflow and reporting capabilities that support integrated operations.',
        ],
        milestones: [
          'Expanded from inbound marketing roots to broad CRM and operations use cases.',
          'Introduced advanced automation and analytics layers for scale-stage teams.',
        ],
        unique_insight:
          'HubSpot is strongest when teams enforce clear lifecycle stages and data ownership from the start.',
      },
      {
        slug: 'segment-profile',
        label: 'Segment',
        category_slug: 'analytics-engineer',
        verified_facts: [
          'Customer data infrastructure platform used for event routing and governance.',
          'Adopted by teams centralizing tracking standards across product and marketing stacks.',
        ],
        milestones: [
          'Scaled from analytics-focused tooling to broader customer data platform capabilities.',
          'Improved governance controls for event quality and destination management.',
        ],
        unique_insight:
          'Segment creates durable value when teams treat event taxonomy as a product with clear ownership.',
      },
    ],
  }
}

async function loadDataset(inputPath?: string): Promise<RawPlaybookDataset> {
  if (!inputPath) {
    return buildDefaultDataset()
  }

  const absolute = path.resolve(process.cwd(), inputPath)
  const raw = await fs.readFile(absolute, 'utf8')
  return JSON.parse(raw) as RawPlaybookDataset
}

async function writeOutputIfNeeded(outputPath: string, payload: string): Promise<void> {
  const absolute = path.resolve(process.cwd(), outputPath)
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  await fs.writeFile(absolute, payload, 'utf8')
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const dataset = await loadDataset(options.input)

  const result = generatePlaybookBatch(dataset, {
    batchSize: options.batchSize,
    batchNumber: options.batchNumber,
    siteBaseUrl: options.siteBaseUrl,
  })

  const payload = JSON.stringify(result, null, 2)

  if (options.output) {
    await writeOutputIfNeeded(options.output, payload)
  }

  process.stdout.write(payload + '\n')
  if (result.status === 'SKIPPED') {
    process.exitCode = 2
  }
}

main().catch((error) => {
  process.stderr.write(
    JSON.stringify(
      {
        status: 'SKIPPED',
        reason: `Generator failed: ${error instanceof Error ? error.message : String(error)}`,
      },
      null,
      2
    ) + '\n'
  )
  process.exit(1)
})
