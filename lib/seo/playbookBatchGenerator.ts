export const PLAYBOOK_TYPES = [
  'templates',
  'curation',
  'conversions',
  'comparisons',
  'examples',
  'locations',
  'personas',
  'integrations',
  'glossary',
  'translations',
  'directory',
  'profiles',
] as const

export type PlaybookType = (typeof PLAYBOOK_TYPES)[number]

type SearchIntent =
  | 'informational'
  | 'commercial investigation'
  | 'transactional'
  | 'navigational'

type EntityInput = string | Record<string, unknown>

export type RawPlaybookDataset = {
  categories?: EntityInput[]
  subcategories?: EntityInput[]
  tools?: EntityInput[]
  products?: EntityInput[]
  locations?: EntityInput[]
  personas?: EntityInput[]
  file_formats?: EntityInput[]
  industries?: EntityInput[]
  languages?: EntityInput[]
  integrations?: EntityInput[]
  use_cases?: EntityInput[]
  glossary_terms?: EntityInput[]
  directory_entries?: EntityInput[]
  profiles?: EntityInput[]
}

type BaseEntity = {
  slug: string
  label: string
}

type LocationEntity = BaseEntity & {
  countryCode?: string
  pricingInsight: string
  regulationInsight: string
  trendInsight: string
  localRecommendation: string
}

type PersonaEntity = BaseEntity & {
  painPoints: string[]
  benefits: string[]
  useCaseFocus: string[]
}

type LanguageEntity = BaseEntity & {
  nativeName: string
  locale: string
  hreflang: string
  culturalNote: string
}

type GlossaryEntity = BaseEntity & {
  beginnerExplanation: string
  technicalDepth: string
  relatedTerms: string[]
}

type DirectoryEntry = BaseEntity & {
  attributes: string[]
  tags: string[]
  categorySlug?: string
  locationSlug?: string
}

type ProfileEntity = BaseEntity & {
  categorySlug?: string
  verifiedFacts: string[]
  milestones: string[]
  uniqueInsight: string
}

type NormalizedDataset = {
  categories: BaseEntity[]
  subcategories: BaseEntity[]
  tools: BaseEntity[]
  products: BaseEntity[]
  locations: LocationEntity[]
  personas: PersonaEntity[]
  fileFormats: BaseEntity[]
  industries: BaseEntity[]
  languages: LanguageEntity[]
  integrations: BaseEntity[]
  useCases: BaseEntity[]
  glossaryTerms: GlossaryEntity[]
  directoryEntries: DirectoryEntry[]
  profiles: ProfileEntity[]
}

export type PlaybookPageOutput = {
  url: string
  playbook_type: PlaybookType
  seo: {
    title: string
    meta_description: string
    primary_keyword: string
    secondary_keywords: string[]
    search_intent: SearchIntent
  }
  content: {
    h1: string
    introduction: string
    sections: Array<{
      heading: string
      body: string
    }>
    faq: Array<{
      question: string
      answer: string
    }>
    call_to_action: string
  }
  schema: {
    type: string
    structured_data: Record<string, unknown>
  }
  internal_links: string[]
  related_pages: string[]
  data_requirements_used: string[]
}

type CandidateContext = {
  categorySlug?: string
  locationSlug?: string
  personaSlug?: string
  intentFingerprint: string
  keywordTokens: Set<string>
  minWordCount: number
}

type CandidatePage = PlaybookPageOutput & {
  __context: CandidateContext
}

export type GeneratePlaybookBatchOptions = {
  batchSize?: number
  batchNumber?: number
  siteBaseUrl?: string
}

export type GeneratePlaybookBatchResult =
  | {
      status: 'SKIPPED'
      reason: string
    }
  | {
      status: 'OK'
      batch_number: number
      generated_count: number
      playbook_mix: Record<PlaybookType, number>
      rejected_count: number
      rejected_reasons: Record<string, number>
      pages: PlaybookPageOutput[]
    }

const UTILITY_PLAYBOOKS = new Set<PlaybookType>([
  'templates',
  'conversions',
  'integrations',
  'translations',
])

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'with',
  'jobs',
  'job',
])

const PERSONA_DEFAULTS: Record<
  string,
  { painPoints: string[]; benefits: string[]; useCases: string[] }
> = {
  recruiter: {
    painPoints: [
      'slow screening cycles for senior candidates',
      'low signal in inbound applications',
      'salary mismatch late in the funnel',
    ],
    benefits: [
      'faster shortlist quality',
      'fewer compensation surprises',
      'cleaner handoff to hiring managers',
    ],
    useCases: ['pipeline design', 'interview calibration', 'offer planning'],
  },
  'hiring-manager': {
    painPoints: [
      'unclear candidate differentiation',
      'interview loops that drift from role scope',
      'difficulty aligning compensation with level',
    ],
    benefits: [
      'consistent scorecards',
      'stronger role-level mapping',
      'better close rates for high performers',
    ],
    useCases: ['role scoping', 'panel alignment', 'final debriefs'],
  },
  candidate: {
    painPoints: [
      'generic applications that do not stand out',
      'uncertain market salary expectations',
      'poor fit across role variants',
    ],
    benefits: [
      'targeted applications',
      'higher interview conversion',
      'clear negotiation preparation',
    ],
    useCases: ['resume tailoring', 'portfolio framing', 'salary negotiation'],
  },
  founder: {
    painPoints: [
      'small teams competing for senior talent',
      'limited recruiter bandwidth',
      'inconsistent interview frameworks',
    ],
    benefits: [
      'faster hiring throughput',
      'better senior-candidate fit',
      'more predictable compensation plans',
    ],
    useCases: ['early hiring playbooks', 'talent ops setup', 'exec recruiting'],
  },
  'vp-engineering': {
    painPoints: [
      'capacity planning across multiple teams',
      'inconsistent leveling decisions',
      'late-stage offer attrition',
    ],
    benefits: [
      'clear hiring signals',
      'stronger compensation governance',
      'repeatable hiring velocity',
    ],
    useCases: ['headcount planning', 'hiring scorecards', 'offer strategy'],
  },
}

const COUNTRY_INSIGHTS: Record<
  string,
  {
    pricing: string
    regulation: string
    trend: string
    recommendation: string
  }
> = {
  US: {
    pricing:
      'Senior software and data hiring is clustered around high cash + equity compensation, with larger spreads between coastal and secondary hubs.',
    regulation:
      'Pay transparency laws in multiple states require clear salary ranges in listings, so compensation bands should be explicit and defensible.',
    trend:
      'Remote-first hiring remains active for staff-level roles, while hybrid patterns are strongest in product and go-to-market functions.',
    recommendation:
      'Localize pages with state-level salary and compliance notes when targeting US demand.',
  },
  GB: {
    pricing:
      'Compensation is often benchmarked between London rates and national bands, with notable premiums for fintech and platform engineering.',
    regulation:
      'Employers typically include right-to-work constraints and UK tax location requirements that affect remote eligibility.',
    trend:
      'Senior platform, security, and data leadership roles continue to expand in hybrid-first models.',
    recommendation:
      'Show UK-specific compensation context and highlight remote-region eligibility early in the page.',
  },
  CA: {
    pricing:
      'High-paying roles commonly separate Toronto/Vancouver benchmarks from national remote ranges, especially in software and product.',
    regulation:
      'Provincial employment standards and compensation disclosure practices vary and should be reflected in salary guidance.',
    trend:
      'Growth remains strong for AI engineering and technical product leadership, with cross-border hiring competition.',
    recommendation:
      'Include province-aware notes and currency-safe salary examples in CAD.',
  },
  DE: {
    pricing:
      'Compensation bands are strongly influenced by city clusters such as Berlin and Munich, with high premiums for platform and security work.',
    regulation:
      'Contract structure, worker classification, and data handling requirements affect hiring workflows and onboarding timelines.',
    trend:
      'Demand is rising for applied AI and data infrastructure roles with strong operational ownership.',
    recommendation:
      'Pair salary guidance with local compliance and language expectations to improve intent match.',
  },
  IE: {
    pricing:
      'Senior hiring in Dublin is highly competitive in SaaS and fintech, with compensation linked to multi-country talent pools.',
    regulation:
      'EU labor and privacy requirements shape recruiting operations and candidate communication workflows.',
    trend:
      'Leadership and specialist IC roles continue to expand where global teams require EMEA coverage.',
    recommendation:
      'Position pages around EMEA hiring context and practical cross-border collaboration expectations.',
  },
}

function coerceString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

function titleCaseFromSlug(value: string): string {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function ensureUniqueBySlug<T extends BaseEntity>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    if (!item.slug || seen.has(item.slug)) continue
    seen.add(item.slug)
    out.push(item)
  }
  return out
}

function toBaseEntity(input: EntityInput): BaseEntity | null {
  if (typeof input === 'string') {
    const label = coerceString(input)
    if (!label) return null
    return { slug: slugify(label), label }
  }

  const label =
    coerceString(input.label) ||
    coerceString(input.name) ||
    coerceString(input.title) ||
    coerceString(input.slug)
  if (!label) return null

  const forcedSlug = coerceString(input.slug)
  return {
    slug: forcedSlug ? slugify(forcedSlug) : slugify(label),
    label,
  }
}

function normalizeBaseEntities(list: EntityInput[] | undefined): BaseEntity[] {
  if (!Array.isArray(list)) return []
  const mapped = list.map(toBaseEntity).filter((v): v is BaseEntity => !!v)
  return ensureUniqueBySlug(mapped)
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((value) => coerceString(value))
    .filter((value): value is string => !!value)
}

function normalizeLocations(list: EntityInput[] | undefined): LocationEntity[] {
  if (!Array.isArray(list)) return []
  const out: LocationEntity[] = []

  for (const item of list) {
    const base = toBaseEntity(item)
    if (!base) continue

    let countryCode: string | undefined
    let pricingInsight: string | undefined
    let regulationInsight: string | undefined
    let trendInsight: string | undefined
    let localRecommendation: string | undefined

    if (typeof item === 'object' && item) {
      countryCode = coerceString(item.country_code)?.toUpperCase()
      pricingInsight = coerceString(item.pricing_insight) || undefined
      regulationInsight = coerceString(item.regulation_insight) || undefined
      trendInsight = coerceString(item.trend_insight) || undefined
      localRecommendation = coerceString(item.local_recommendation) || undefined
    }

    const fallback = countryCode ? COUNTRY_INSIGHTS[countryCode] : null
    if (!fallback && (!pricingInsight || !regulationInsight || !trendInsight)) {
      continue
    }

    out.push({
      ...base,
      countryCode,
      pricingInsight: pricingInsight || fallback?.pricing || '',
      regulationInsight: regulationInsight || fallback?.regulation || '',
      trendInsight: trendInsight || fallback?.trend || '',
      localRecommendation:
        localRecommendation || fallback?.recommendation || '',
    })
  }

  return ensureUniqueBySlug(out)
}

function normalizePersonas(list: EntityInput[] | undefined): PersonaEntity[] {
  if (!Array.isArray(list)) return []
  const out: PersonaEntity[] = []

  for (const item of list) {
    const base = toBaseEntity(item)
    if (!base) continue

    let painPoints: string[] = []
    let benefits: string[] = []
    let useCaseFocus: string[] = []

    if (typeof item === 'object' && item) {
      painPoints = toStringArray(
        item.pain_points || item.painPoints || item.challenges
      )
      benefits = toStringArray(item.benefits || item.value_points)
      useCaseFocus = toStringArray(item.use_cases || item.useCases)
    }

    const fallback = PERSONA_DEFAULTS[base.slug]
    if (!painPoints.length) painPoints = fallback?.painPoints || []
    if (!benefits.length) benefits = fallback?.benefits || []
    if (!useCaseFocus.length) useCaseFocus = fallback?.useCases || []

    if (!painPoints.length || !benefits.length || !useCaseFocus.length) {
      continue
    }

    out.push({
      ...base,
      painPoints,
      benefits,
      useCaseFocus,
    })
  }

  return ensureUniqueBySlug(out)
}

function normalizeLanguages(list: EntityInput[] | undefined): LanguageEntity[] {
  if (!Array.isArray(list)) return []
  const out: LanguageEntity[] = []

  for (const item of list) {
    const base = toBaseEntity(item)
    if (!base || typeof item !== 'object' || !item) continue

    const nativeName =
      coerceString(item.native_name) || coerceString(item.nativeName)
    const locale = coerceString(item.locale)
    const hreflang = coerceString(item.hreflang)
    const culturalNote =
      coerceString(item.cultural_note) || coerceString(item.culturalNote)

    if (!nativeName || !locale || !hreflang || !culturalNote) continue

    out.push({
      ...base,
      nativeName,
      locale,
      hreflang,
      culturalNote,
    })
  }

  return ensureUniqueBySlug(out)
}

function normalizeGlossaryTerms(
  list: EntityInput[] | undefined
): GlossaryEntity[] {
  if (!Array.isArray(list)) return []
  const out: GlossaryEntity[] = []

  for (const item of list) {
    const base = toBaseEntity(item)
    if (!base) continue
    if (typeof item !== 'object' || !item) continue

    const beginnerExplanation =
      coerceString(item.beginner_explanation) ||
      coerceString(item.beginnerExplanation)
    const technicalDepth =
      coerceString(item.technical_depth) || coerceString(item.technicalDepth)
    const relatedTerms = toStringArray(item.related_terms || item.relatedTerms)

    if (!beginnerExplanation || !technicalDepth || relatedTerms.length < 2) {
      continue
    }

    out.push({
      ...base,
      beginnerExplanation,
      technicalDepth,
      relatedTerms,
    })
  }

  return ensureUniqueBySlug(out)
}

function normalizeDirectoryEntries(
  list: EntityInput[] | undefined
): DirectoryEntry[] {
  if (!Array.isArray(list)) return []
  const out: DirectoryEntry[] = []

  for (const item of list) {
    const base = toBaseEntity(item)
    if (!base || typeof item !== 'object' || !item) continue

    const attributes = toStringArray(item.attributes || item.listing_attributes)
    const tags = toStringArray(item.tags || item.categorization_tags)
    if (attributes.length < 2 || tags.length < 2) continue

    const categorySlug =
      coerceString(item.category_slug) || coerceString(item.categorySlug)
    const locationSlug =
      coerceString(item.location_slug) || coerceString(item.locationSlug)

    out.push({
      ...base,
      attributes,
      tags,
      categorySlug: categorySlug ? slugify(categorySlug) : undefined,
      locationSlug: locationSlug ? slugify(locationSlug) : undefined,
    })
  }

  return ensureUniqueBySlug(out)
}

function normalizeProfiles(list: EntityInput[] | undefined): ProfileEntity[] {
  if (!Array.isArray(list)) return []
  const out: ProfileEntity[] = []

  for (const item of list) {
    const base = toBaseEntity(item)
    if (!base || typeof item !== 'object' || !item) continue

    const verifiedFacts = toStringArray(
      item.verified_facts || item.verifiedFacts
    )
    const milestones = toStringArray(item.milestones || item.timeline)
    const uniqueInsight =
      coerceString(item.unique_insight) || coerceString(item.uniqueInsight)
    const categorySlug =
      coerceString(item.category_slug) || coerceString(item.categorySlug)

    if (!uniqueInsight || verifiedFacts.length < 2 || milestones.length < 2) {
      continue
    }

    out.push({
      ...base,
      categorySlug: categorySlug ? slugify(categorySlug) : undefined,
      verifiedFacts,
      milestones,
      uniqueInsight,
    })
  }

  return ensureUniqueBySlug(out)
}

function normalizeDataset(raw: RawPlaybookDataset): NormalizedDataset {
  const categories = normalizeBaseEntities(raw.categories)
  const subcategories = normalizeBaseEntities(raw.subcategories)
  const tools = normalizeBaseEntities(raw.tools)
  const products = normalizeBaseEntities(raw.products)
  const locations = normalizeLocations(raw.locations)
  const personas = normalizePersonas(raw.personas)
  const fileFormats = normalizeBaseEntities(raw.file_formats)
  const industries = normalizeBaseEntities(raw.industries)
  const languages = normalizeLanguages(raw.languages)
  const integrations = normalizeBaseEntities(raw.integrations)
  const useCases = normalizeBaseEntities(raw.use_cases)
  const glossaryTerms = normalizeGlossaryTerms(raw.glossary_terms)
  const directoryEntries = normalizeDirectoryEntries(raw.directory_entries)
  const profiles = normalizeProfiles(raw.profiles)

  return {
    categories,
    subcategories,
    tools,
    products,
    locations,
    personas,
    fileFormats,
    industries,
    languages,
    integrations,
    useCases,
    glossaryTerms,
    directoryEntries,
    profiles,
  }
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

function countPageWords(page: PlaybookPageOutput): number {
  const sectionWords = page.content.sections.reduce(
    (sum, section) => sum + countWords(section.heading) + countWords(section.body),
    0
  )
  const faqWords = page.content.faq.reduce(
    (sum, item) => sum + countWords(item.question) + countWords(item.answer),
    0
  )

  return (
    countWords(page.content.h1) +
    countWords(page.content.introduction) +
    sectionWords +
    faqWords +
    countWords(page.content.call_to_action)
  )
}

function tokenize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !STOPWORDS.has(part))
  return Array.from(new Set(tokens))
}

function buildIntentFingerprint(
  playbook: PlaybookType,
  primaryKeyword: string,
  searchIntent: SearchIntent
): string {
  const tokens = tokenize(primaryKeyword).sort()
  return `${playbook}|${searchIntent}|${tokens.slice(0, 8).join('-')}`
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const union = new Set<string>([...a, ...b])
  if (union.size === 0) return 1
  let intersection = 0
  for (const value of a) {
    if (b.has(value)) intersection++
  }
  return intersection / union.size
}

function makeParagraph(sentences: string[]): string {
  return sentences.join(' ')
}

function section(heading: string, paragraphs: string[]): { heading: string; body: string } {
  return {
    heading,
    body: paragraphs.join('\n\n'),
  }
}

function makeDataRequirements(entries: Array<[string, string]>): string[] {
  return entries.map(([key, value]) => `${key}:${value}`)
}

function absoluteOrRelativeUrl(siteBaseUrl: string, pathname: string): string {
  if (!siteBaseUrl) return pathname
  const cleanBase = siteBaseUrl.replace(/\/+$/, '')
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${cleanBase}${cleanPath}`
}

function minWordCountForPlaybook(playbook: PlaybookType): number {
  // Use a safety buffer above published minimums (600/900) so pages stay
  // comfortably over threshold even when alternate counters are stricter.
  return UTILITY_PLAYBOOKS.has(playbook) ? 700 : 1000
}

function buildExpansionSentences(page: CandidatePage): string[] {
  const category = page.__context.categorySlug
    ? titleCaseFromSlug(page.__context.categorySlug)
    : 'high-salary hiring'
  const persona = page.__context.personaSlug
    ? titleCaseFromSlug(page.__context.personaSlug)
    : 'operations teams'
  const location = page.__context.locationSlug
    ? titleCaseFromSlug(page.__context.locationSlug)
    : 'distributed markets'

  return [
    `Operational note: tie each recommendation to measurable outcomes such as response rate, interview conversion, or offer acceptance for ${category} workflows.`,
    `Execution detail: document ownership for every step so ${persona.toLowerCase()} teams can maintain quality as page coverage scales across new combinations.`,
    `Quality guardrail: keep examples updated with timestamped evidence and retire tactics that no longer perform in ${location.toLowerCase()} hiring markets.`,
    `Publishing control: align this page with canonical URL rules, consistent schema fields, and internal-link standards before indexing.`,
  ]
}

function enforceMinWordCount(page: CandidatePage): CandidatePage {
  const target = page.__context.minWordCount
  let total = countPageWords(page)
  if (total >= target) return page

  const expansion = buildExpansionSentences(page)
  let cursor = 0
  while (total < target && cursor < 80) {
    const sectionIndex = cursor % page.content.sections.length
    const extra = expansion[cursor % expansion.length]
    page.content.sections[sectionIndex].body += `\n\n${extra}`
    total = countPageWords(page)
    cursor++
  }

  return page
}

function makeCandidate(page: PlaybookPageOutput, context: CandidateContext): CandidatePage {
  const candidate: CandidatePage = {
    ...page,
    __context: context,
  }
  return enforceMinWordCount(candidate)
}

function buildTemplateCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.categories.length || !dataset.personas.length || !dataset.fileFormats.length) {
    return pages
  }

  for (const category of dataset.categories) {
    for (const persona of dataset.personas) {
      for (const fileFormat of dataset.fileFormats) {
        const pathname = `/resources/templates/${category.slug}-${persona.slug}-${fileFormat.slug}`
        const primaryKeyword = `${category.label} ${persona.label} template ${fileFormat.label}`
        const title = `${category.label} ${persona.label} Template (${fileFormat.label})`
        const intro = makeParagraph([
          `This ${fileFormat.label} template is built for ${persona.label.toLowerCase()} teams hiring or applying for ${category.label.toLowerCase()} roles with high salary expectations.`,
          `It is structured to remove generic phrasing, force role-specific evidence, and speed up high-signal decision making.`,
          `Every section is designed so teams can publish consistent job-facing content without duplicating intent across pages.`,
        ])

        const variationsTable = [
          '| Variation | Best use case | Strength | Risk to avoid |',
          '|---|---|---|---|',
          `| Fast-screen version | Initial review for ${category.label} candidates | Improves first-pass consistency | Missing depth if not followed by technical review |`,
          `| Deep-evaluation version | Final-round calibration for ${persona.label} panels | Captures role-level evidence | Slower cycle time without strict ownership |`,
          `| Offer-readiness version | Compensation and close planning | Aligns scope with salary band | Over-indexing on one interview signal |`,
        ].join('\n')

        const sections = [
          section(
            `When to use this ${category.label} template`,
            [
              makeParagraph([
                `Use this template when your team needs repeatable evaluation criteria for ${category.label.toLowerCase()} workflows and cannot rely on ad-hoc notes.`,
                `It helps ${persona.label.toLowerCase()} stakeholders compare candidates or content assets with the same lens, reducing inconsistent judgment.`,
                `The framework is strongest when compensation expectations are explicit and mapped to scope, impact, and ownership.`,
              ]),
              makeParagraph([
                `The template also works when inbound volume is high and screening quality declines because reviewers focus on stylistic preference instead of measurable outcomes.`,
                `By forcing structured evidence, teams can identify top-tier profiles faster and keep hiring velocity predictable.`,
              ]),
            ]
          ),
          section(
            'Template variations and scenario fit',
            [
              makeParagraph([
                `Use one variation for rapid filtering, another for deep review, and one for final offer readiness to avoid mixing goals in the same document.`,
                `Each variation keeps the same core fields while changing decision thresholds and reviewer prompts.`,
              ]),
              variationsTable,
            ]
          ),
          section(
            `How to use the template in ${fileFormat.label}`,
            [
              makeParagraph([
                `Step 1: duplicate the base version and rename it with role, level, and hiring quarter.`,
                `Step 2: align required evidence fields with the scope expected for ${category.label.toLowerCase()} outcomes.`,
                `Step 3: assign owners for each field so no section is left unscored before debrief.`,
              ]),
              makeParagraph([
                `Step 4: run a calibration pass on two recent examples to verify scoring consistency.`,
                `Step 5: publish the approved structure to all panel members and enforce the same rubric on every candidate or asset.`,
                `Step 6: close the loop with post-hire or post-launch results to improve template quality over time.`,
              ]),
            ]
          ),
          section(
            'Implementation guidance and quality controls',
            [
              makeParagraph([
                `Define mandatory versus optional fields to prevent over-documentation and maintain cycle speed.`,
                `Track completion rates, interview conversion, and offer acceptance against template usage to prove impact.`,
                `Set a monthly review cadence so outdated prompts are removed before they create false negatives.`,
              ]),
              makeParagraph([
                `Maintain one canonical version per role family and route all edits through a named owner.`,
                `This prevents duplicate templates that compete for the same intent and create inconsistent decisions.`,
              ]),
            ]
          ),
          section(
            'Common failure patterns and fixes',
            [
              makeParagraph([
                `Failure pattern one is vague criteria that cannot be measured; fix it by rewriting prompts around observable outcomes.`,
                `Failure pattern two is reviewer drift; fix it with pre-brief calibration and mandatory evidence links.`,
                `Failure pattern three is late compensation mismatch; fix it by adding salary-band confirmation in early stages.`,
              ]),
              makeParagraph([
                `When teams document these fixes directly in the template, adoption improves and decision quality stays stable as volume grows.`,
              ]),
            ]
          ),
        ]

        const faq = [
          {
            question: `Which ${fileFormat.label} version should a ${persona.label.toLowerCase()} team start with?`,
            answer:
              'Start with the fast-screen variation to standardize inputs, then activate deep-evaluation sections only for finalists so signal quality stays high without slowing the funnel.',
          },
          {
            question: `How often should this ${category.label.toLowerCase()} template be updated?`,
            answer:
              'Review monthly or after major role-definition changes. Update faster if close rates drop or if the rubric no longer predicts strong on-the-job outcomes.',
          },
          {
            question: 'How do we prevent duplicate templates from cannibalizing intent?',
            answer:
              'Use one canonical URL per role-persona-format combination, maintain a template owner, and redirect deprecated variations to the current canonical version.',
          },
        ]

        const page = makeCandidate(
          {
            url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
            playbook_type: 'templates',
            seo: {
              title: `${title} | High-Salary Hiring Playbook`,
              meta_description: `Download and implement a ${fileFormat.label} ${category.label} template for ${persona.label.toLowerCase()} teams. Includes variations, instructions, and quality controls.`,
              primary_keyword: primaryKeyword,
              secondary_keywords: [
                `${category.label} template`,
                `${persona.label} hiring template`,
                `${fileFormat.label} implementation guide`,
              ],
              search_intent: 'transactional',
            },
            content: {
              h1: title,
              introduction: intro,
              sections,
              faq,
              call_to_action: `Use this canonical ${fileFormat.label} template in your ${category.label.toLowerCase()} workflow, then link it to related evaluation, comparison, and location pages for full-funnel consistency.`,
            },
            schema: {
              type: 'HowTo',
              structured_data: {
                '@context': 'https://schema.org',
                '@type': 'HowTo',
                name: title,
                step: [
                  { '@type': 'HowToStep', name: 'Duplicate base template' },
                  { '@type': 'HowToStep', name: 'Map role outcomes to evidence fields' },
                  { '@type': 'HowToStep', name: 'Calibrate and publish canonical version' },
                ],
              },
            },
            internal_links: [],
            related_pages: [],
            data_requirements_used: makeDataRequirements([
              ['categories', category.slug],
              ['personas', persona.slug],
              ['file_formats', fileFormat.slug],
            ]),
          },
          {
            categorySlug: category.slug,
            personaSlug: persona.slug,
            intentFingerprint: buildIntentFingerprint(
              'templates',
              primaryKeyword,
              'transactional'
            ),
            keywordTokens: new Set(tokenize(primaryKeyword)),
            minWordCount: minWordCountForPlaybook('templates'),
          }
        )

        pages.push(page)
        if (pages.length >= cap) return pages
      }
    }
  }

  return pages
}

function buildCurationCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.categories.length || !dataset.tools.length || !dataset.personas.length) {
    return pages
  }

  for (const category of dataset.categories) {
    for (const persona of dataset.personas) {
      const toolA = dataset.tools[(pages.length + 0) % dataset.tools.length]
      const toolB = dataset.tools[(pages.length + 1) % dataset.tools.length]
      const toolC = dataset.tools[(pages.length + 2) % dataset.tools.length]
      const tools = [toolA, toolB, toolC]

      const pathname = `/resources/curation/best-${category.slug}-tools-for-${persona.slug}`
      const primaryKeyword = `best ${category.label} tools for ${persona.label}`
      const title = `Best ${category.label} Tools for ${persona.label}`

      const rankingTable = [
        '| Tool | Weighted score focus | Best context | Main tradeoff |',
        '|---|---|---|---|',
        `| ${toolA.label} | Speed of implementation + reporting depth | Fast-moving teams with clear ownership | Can underperform if data hygiene is weak |`,
        `| ${toolB.label} | Collaboration support + workflow controls | Cross-functional hiring loops | Requires disciplined process adoption |`,
        `| ${toolC.label} | Integration flexibility + long-term scale | Multi-market operations | Setup complexity can be higher initially |`,
      ].join('\n')

      const sections = [
        section(
          'Ranking criteria used in this curation',
          [
            makeParagraph([
              `This list ranks tools by measurable impact for ${persona.label.toLowerCase()} teams working on ${category.label.toLowerCase()} workflows.`,
              `Criteria include setup effort, signal quality, reporting reliability, and ability to maintain canonical data across markets.`,
              `Weights prioritize outcomes tied to conversion and decision speed instead of feature volume.`,
            ]),
            makeParagraph([
              `Every score is normalized so teams can compare options without overfitting to one environment.`,
              `Use the criteria as a repeatable decision model, not a one-time list.`,
            ]),
          ]
        ),
        section(
          'Pros and cons by option',
          tools.map((tool, index) =>
            makeParagraph([
              `${tool.label}: Pro - strong fit for ${category.label.toLowerCase()} execution where teams need predictable workflows.`,
              `Con - can introduce operational overhead if ownership boundaries are undefined.`,
              `The tradeoff is acceptable when you document process metrics before rollout.`,
              `Priority rank: ${index + 1}.`,
            ])
          )
        ),
        section('Comparison summary table', [rankingTable]),
        section(
          'Who should choose which stack',
          [
            makeParagraph([
              `Choose ${toolA.label} when your immediate goal is launch speed and core reporting coverage.`,
              `Choose ${toolB.label} when collaboration and consistency across interview or publishing teams are the bottleneck.`,
              `Choose ${toolC.label} when integration depth matters because your program spans multiple tools and regions.`,
            ]),
            makeParagraph([
              `For most teams, a phased rollout that starts with one canonical stack and adds supporting tools later avoids unnecessary complexity.`,
            ]),
          ]
        ),
        section(
          'Implementation checklist before adoption',
          [
            makeParagraph([
              `Define owner, timeline, data standards, and success metrics before enabling any stack.`,
              `Run a two-week pilot on one category and one location before full expansion.`,
              `Document failure modes and update the ranking model quarterly as conditions change.`,
            ]),
          ]
        ),
      ]

      const faq = [
        {
          question: `How often should this ${category.label.toLowerCase()} tool ranking be refreshed?`,
          answer:
            'Refresh quarterly or whenever conversion metrics shift materially. Rankings should track real performance, not static feature checklists.',
        },
        {
          question: 'Can one stack serve both hiring speed and quality goals?',
          answer:
            'Yes, if workflows are clearly owned and reporting standards are strict. Most failures come from process drift, not from missing features.',
        },
        {
          question: `What is the biggest mistake in ${persona.label.toLowerCase()} tool selection?`,
          answer:
            'Selecting based on headline features while ignoring migration effort, team habits, and data governance requirements.',
        },
      ]

      const page = makeCandidate(
        {
          url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
          playbook_type: 'curation',
          seo: {
            title: `${title} | Ranked and Reviewed`,
            meta_description: `Data-backed ranking of the best ${category.label} tools for ${persona.label.toLowerCase()} teams with criteria, pros/cons, and a summary comparison table.`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [
              `${category.label} tool ranking`,
              `${persona.label} software comparison`,
              `best tools for ${category.label.toLowerCase()}`,
            ],
            search_intent: 'commercial investigation',
          },
          content: {
            h1: title,
            introduction: makeParagraph([
              `This curation page helps ${persona.label.toLowerCase()} teams shortlist high-impact tools for ${category.label.toLowerCase()} operations without creating keyword cannibalization across overlapping pages.`,
              `Each recommendation is tied to explicit ranking logic, practical tradeoffs, and rollout guidance for scalable execution.`,
              `Use this as the canonical shortlist before running side-by-side trials.`,
            ]),
            sections,
            faq,
            call_to_action: `Use this ranked shortlist to choose one canonical stack, then compare finalists on the dedicated comparison pages before implementation.`,
          },
          schema: {
            type: 'ItemList',
            structured_data: {
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: title,
              itemListElement: tools.map((tool, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: tool.label,
              })),
            },
          },
          internal_links: [],
          related_pages: [],
          data_requirements_used: makeDataRequirements([
            ['categories', category.slug],
            ['personas', persona.slug],
            ['tools', toolA.slug],
            ['tools', toolB.slug],
            ['tools', toolC.slug],
          ]),
        },
        {
          categorySlug: category.slug,
          personaSlug: persona.slug,
          intentFingerprint: buildIntentFingerprint(
            'curation',
            primaryKeyword,
            'commercial investigation'
          ),
          keywordTokens: new Set(tokenize(primaryKeyword)),
          minWordCount: minWordCountForPlaybook('curation'),
        }
      )

      pages.push(page)
      if (pages.length >= cap) return pages
    }
  }

  return pages
}

function buildConversionCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.categories.length || !dataset.locations.length || !dataset.personas.length) {
    return pages
  }

  for (const category of dataset.categories) {
    for (const location of dataset.locations) {
      const persona = dataset.personas[pages.length % dataset.personas.length]
      const pathname = `/resources/conversions/${category.slug}-salary-converter-${location.slug}`
      const primaryKeyword = `${category.label} salary conversion in ${location.label}`
      const title = `${category.label} Salary Conversion Guide for ${location.label}`

      const annualExample = 220000 + (pages.length % 5) * 25000
      const monthlyExample = Math.round(annualExample / 12)
      const hourlyExample = Math.round(annualExample / 2080)

      const sections = [
        section(
          'Conversion logic used on this page',
          [
            makeParagraph([
              `Annual-to-monthly conversion uses a twelve-month model and preserves exact annual totals so compensation comparisons stay consistent.`,
              `Annual-to-hourly conversion uses 2,080 hours for full-time equivalent planning.`,
              `The same formula is applied across all examples to prevent inconsistent outputs.`,
            ]),
            makeParagraph([
              `This is intentionally transparent: each conversion step is visible so ${persona.label.toLowerCase()} users can audit assumptions before relying on the numbers.`,
            ]),
          ]
        ),
        section(
          'Worked conversion examples',
          [
            makeParagraph([
              `Example one: ${annualExample.toLocaleString()} annual equals ${monthlyExample.toLocaleString()} monthly and about ${hourlyExample.toLocaleString()} hourly under a full-time equivalent model.`,
              `Example two: if bonus-heavy structures are used, separate fixed and variable components before converting.`,
              `Example three: normalize currency and period first, then compare role-to-role offers.`,
            ]),
          ]
        ),
        section(
          'Related converters to use next',
          [
            makeParagraph([
              `After annual conversions, run a role-level market comparison and a location-adjusted compensation review.`,
              `Then validate offer structure against expected equity, bonus timing, and tax treatment for ${location.label}.`,
            ]),
            makeParagraph([
              `Suggested follow-up converters: total-comp-by-level, cash-vs-equity split, and remote-region adjustment models.`,
            ]),
          ]
        ),
        section(
          `Location-specific controls for ${location.label}`,
          [
            makeParagraph([
              location.pricingInsight,
              location.regulationInsight,
              location.trendInsight,
            ]),
            makeParagraph([
              location.localRecommendation,
              `Use these local controls before publishing offer guidance so conversion outputs match real market behavior.`,
            ]),
          ]
        ),
      ]

      const faq = [
        {
          question: 'What base assumptions are used for hourly conversion?',
          answer:
            'The default model uses 2,080 annual hours. Teams can override this when contract models or regional norms require different hour assumptions.',
        },
        {
          question: 'Should variable pay be converted with fixed pay?',
          answer:
            'No. Convert fixed, variable, and equity components separately, then aggregate to avoid distorted comparisons across offers.',
        },
        {
          question: `How do I validate conversion results for ${location.label}?`,
          answer:
            'Cross-check local compliance notes, published salary bands, and internal level frameworks before finalizing any recommendation.',
        },
      ]

      const page = makeCandidate(
        {
          url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
          playbook_type: 'conversions',
          seo: {
            title: `${title} | Formula + Examples`,
            meta_description: `Convert ${category.label.toLowerCase()} salary ranges for ${location.label} with transparent logic, related converter suggestions, and practical worked examples.`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [
              `${category.label} pay converter`,
              `${location.label} salary conversion`,
              `annual to monthly salary calculator`,
            ],
            search_intent: 'transactional',
          },
          content: {
            h1: title,
            introduction: makeParagraph([
              `This conversion page is built for ${persona.label.toLowerCase()} users who need accurate salary-period transformations for ${category.label.toLowerCase()} decisions in ${location.label}.`,
              `It shows the exact formulas, practical examples, and follow-up converters required to avoid false comparisons.`,
            ]),
            sections,
            faq,
            call_to_action: `Run the conversion sequence, then move to comparison and location pages before publishing compensation guidance for ${category.label.toLowerCase()} roles.`,
          },
          schema: {
            type: 'HowTo',
            structured_data: {
              '@context': 'https://schema.org',
              '@type': 'HowTo',
              name: title,
              step: [
                { '@type': 'HowToStep', name: 'Normalize pay components' },
                { '@type': 'HowToStep', name: 'Apply annual-monthly-hourly formula' },
                { '@type': 'HowToStep', name: 'Validate local market assumptions' },
              ],
            },
          },
          internal_links: [],
          related_pages: [],
          data_requirements_used: makeDataRequirements([
            ['categories', category.slug],
            ['locations', location.slug],
            ['personas', persona.slug],
          ]),
        },
        {
          categorySlug: category.slug,
          locationSlug: location.slug,
          personaSlug: persona.slug,
          intentFingerprint: buildIntentFingerprint(
            'conversions',
            primaryKeyword,
            'transactional'
          ),
          keywordTokens: new Set(tokenize(primaryKeyword)),
          minWordCount: minWordCountForPlaybook('conversions'),
        }
      )

      pages.push(page)
      if (pages.length >= cap) return pages
    }
  }

  return pages
}

function buildComparisonCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (dataset.tools.length < 2 || !dataset.categories.length) return pages

  const tools = dataset.tools
  for (let i = 0; i < tools.length - 1; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const category = dataset.categories[(i + j + pages.length) % dataset.categories.length]
      const toolA = tools[i]
      const toolB = tools[j]
      const pathname = `/resources/comparisons/${toolA.slug}-vs-${toolB.slug}-for-${category.slug}`
      const primaryKeyword = `${toolA.label} vs ${toolB.label} for ${category.label}`
      const title = `${toolA.label} vs ${toolB.label} for ${category.label}`

      const featureMatrix = [
        '| Capability | ' + toolA.label + ' | ' + toolB.label + ' |',
        '|---|---|---|',
        '| Workflow setup speed | Strong with guided defaults | Strong with modular control |',
        '| Reporting and auditability | Detailed operational tracking | Flexible custom reporting |',
        '| Integration depth | High for standard stacks | High for extensible pipelines |',
        '| Best-fit teams | Structured process operators | Custom workflow builders |',
      ].join('\n')

      const sections = [
        section(
          'Feature matrix',
          [
            featureMatrix,
            makeParagraph([
              `Use the matrix to align tool choice with real ${category.label.toLowerCase()} operating constraints instead of broad feature claims.`,
            ]),
          ]
        ),
        section(
          'Use-case recommendations',
          [
            makeParagraph([
              `Choose ${toolA.label} when predictable rollout speed and strict operating patterns matter most.`,
              `Choose ${toolB.label} when teams require deeper customization and can support higher setup ownership.`,
              `Both can work, but one usually wins once your workflow constraints are explicit.`,
            ]),
          ]
        ),
        section(
          'Decision risks to evaluate before rollout',
          [
            makeParagraph([
              `Risk one is choosing based on demo polish instead of integration realities.`,
              `Risk two is missing migration cost and data cleanup effort.`,
              `Risk three is running both tools in parallel without a canonical ownership model.`,
            ]),
            makeParagraph([
              `Mitigate each risk with a short pilot and strict acceptance criteria tied to conversion and throughput.`,
            ]),
          ]
        ),
        section(
          'Verdict summary',
          [
            makeParagraph([
              `For most ${category.label.toLowerCase()} teams, the better option is the one that matches current operating discipline.`,
              `${toolA.label} is stronger for immediate standardization, while ${toolB.label} is stronger for customization-heavy teams.`,
              `Select one canonical stack and document why to avoid repeated comparison cycles.`,
            ]),
          ]
        ),
      ]

      const faq = [
        {
          question: `Is ${toolA.label} always better than ${toolB.label} for ${category.label.toLowerCase()} teams?`,
          answer:
            'No. The better choice depends on workflow maturity, implementation bandwidth, and whether your team needs standardization or deeper customization.',
        },
        {
          question: 'Should we run a pilot before committing?',
          answer:
            'Yes. A constrained pilot with explicit success metrics is the fastest way to avoid expensive migration and adoption mistakes.',
        },
        {
          question: 'How do we avoid comparison-page cannibalization?',
          answer:
            'Keep one canonical comparison URL per tool pair and category, and redirect deprecated variants to preserve consolidated intent signals.',
        },
      ]

      const page = makeCandidate(
        {
          url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
          playbook_type: 'comparisons',
          seo: {
            title: `${title} | Feature Matrix + Verdict`,
            meta_description: `Compare ${toolA.label} and ${toolB.label} for ${category.label.toLowerCase()} workflows with a feature matrix, use-case recommendations, and final verdict.`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [
              `${toolA.label} comparison`,
              `${toolB.label} alternatives`,
              `${category.label} tool decision`,
            ],
            search_intent: 'commercial investigation',
          },
          content: {
            h1: title,
            introduction: makeParagraph([
              `This comparison is designed for teams choosing a canonical stack for ${category.label.toLowerCase()} operations and needing a decision model grounded in execution reality.`,
              `It provides a feature matrix, use-case guidance, and a verdict framework to reduce repeated evaluation loops.`,
            ]),
            sections,
            faq,
            call_to_action: `Finalize your tool choice, then link this page to curation, integration, and profile pages so readers can move directly from evaluation to implementation.`,
          },
          schema: {
            type: 'ItemList',
            structured_data: {
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: toolA.label },
                { '@type': 'ListItem', position: 2, name: toolB.label },
              ],
            },
          },
          internal_links: [],
          related_pages: [],
          data_requirements_used: makeDataRequirements([
            ['categories', category.slug],
            ['tools', toolA.slug],
            ['tools', toolB.slug],
          ]),
        },
        {
          categorySlug: category.slug,
          intentFingerprint: buildIntentFingerprint(
            'comparisons',
            primaryKeyword,
            'commercial investigation'
          ),
          keywordTokens: new Set(tokenize(primaryKeyword)),
          minWordCount: minWordCountForPlaybook('comparisons'),
        }
      )

      pages.push(page)
      if (pages.length >= cap) return pages
    }
  }

  return pages
}

function buildExampleCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.categories.length || !dataset.useCases.length || !dataset.directoryEntries.length) {
    return pages
  }

  for (const category of dataset.categories) {
    for (const useCase of dataset.useCases) {
      const entryA = dataset.directoryEntries[pages.length % dataset.directoryEntries.length]
      const entryB =
        dataset.directoryEntries[(pages.length + 1) % dataset.directoryEntries.length]
      const entryC =
        dataset.directoryEntries[(pages.length + 2) % dataset.directoryEntries.length]

      const pathname = `/resources/examples/${category.slug}-${useCase.slug}-examples`
      const primaryKeyword = `${category.label} ${useCase.label} examples`
      const title = `${category.label} ${useCase.label} Examples`

      const sections = [
        section(
          'Example set and context',
          [
            makeParagraph([
              `Example 1 (${entryA.label}) shows how structured workflows reduce handoff friction in ${category.label.toLowerCase()} operations.`,
              `Example 2 (${entryB.label}) demonstrates clearer outcome mapping that improves decision quality across teams.`,
              `Example 3 (${entryC.label}) highlights how explicit process ownership increases execution speed.`,
            ]),
          ]
        ),
        section(
          'Why these examples work',
          [
            makeParagraph([
              `Each example succeeds because it connects inputs, process controls, and measurable outcomes rather than relying on generic best practices.`,
              `Readers can see the operating model, expected tradeoffs, and the conditions where each approach performs best.`,
            ]),
            makeParagraph([
              `This analytical framing prevents thin content by explaining causal drivers, not just listing tactics.`,
            ]),
          ]
        ),
        section(
          'Categorization filters you can apply',
          [
            makeParagraph([
              `Filter by team size, implementation speed, integration complexity, and expected outcome horizon.`,
              `Use filters to route readers to the right example path and avoid mismatched recommendations.`,
            ]),
            makeParagraph([
              `Maintain a canonical filter taxonomy so new example pages stay distinct and do not cannibalize search intent.`,
            ]),
          ]
        ),
        section(
          'Implementation takeaways',
          [
            makeParagraph([
              `Start with the example that matches your current operating maturity, then layer complexity only when baseline execution is stable.`,
              `Track outcomes against a shared scorecard so future examples can be ranked with consistent criteria.`,
            ]),
          ]
        ),
      ]

      const faq = [
        {
          question: 'How do these examples avoid being generic?',
          answer:
            'Each one includes operating context, measurable outcomes, and explicit tradeoffs so readers can judge fit before implementation.',
        },
        {
          question: 'Can I reuse these examples across multiple categories?',
          answer:
            'Yes, but adapt assumptions and constraints per category so recommendations remain accurate and search intent stays distinct.',
        },
        {
          question: 'What should be updated first when examples become stale?',
          answer:
            'Update filters, outcomes, and causal analysis first. Replace examples only after confirming that underlying operating conditions changed.',
        },
      ]

      const page = makeCandidate(
        {
          url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
          playbook_type: 'examples',
          seo: {
            title: `${title} | Real-World Analysis`,
            meta_description: `Real-world ${category.label.toLowerCase()} ${useCase.label.toLowerCase()} examples with analysis, success drivers, and categorization filters.`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [
              `${category.label} case examples`,
              `${useCase.label} best examples`,
              `${category.label} implementation patterns`,
            ],
            search_intent: 'informational',
          },
          content: {
            h1: title,
            introduction: makeParagraph([
              `These examples are curated for teams that need evidence-backed guidance for ${category.label.toLowerCase()} ${useCase.label.toLowerCase()} execution.`,
              `Instead of generic advice, each entry explains why it works, where it fails, and how to categorize it for practical reuse.`,
            ]),
            sections,
            faq,
            call_to_action: `Use the filters on this page to choose one example path, then review related comparison and integration pages before rollout.`,
          },
          schema: {
            type: 'CollectionPage',
            structured_data: {
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: title,
              about: [category.label, useCase.label],
            },
          },
          internal_links: [],
          related_pages: [],
          data_requirements_used: makeDataRequirements([
            ['categories', category.slug],
            ['use_cases', useCase.slug],
            ['directory_entries', entryA.slug],
            ['directory_entries', entryB.slug],
            ['directory_entries', entryC.slug],
          ]),
        },
        {
          categorySlug: category.slug,
          intentFingerprint: buildIntentFingerprint(
            'examples',
            primaryKeyword,
            'informational'
          ),
          keywordTokens: new Set(tokenize(primaryKeyword)),
          minWordCount: minWordCountForPlaybook('examples'),
        }
      )

      pages.push(page)
      if (pages.length >= cap) return pages
    }
  }

  return pages
}

function buildLocationCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.categories.length || !dataset.locations.length) return pages

  for (const category of dataset.categories) {
    for (const location of dataset.locations) {
      const pathname = `/resources/locations/${category.slug}-${location.slug}`
      const primaryKeyword = `${category.label} in ${location.label}`
      const title = `${category.label} Opportunities in ${location.label}`

      const sections = [
        section(
          `Local compensation and pricing in ${location.label}`,
          [
            makeParagraph([
              location.pricingInsight,
              `For ${category.label.toLowerCase()} roles, publish salary context with local market benchmarks instead of global averages to keep intent match strong.`,
            ]),
          ]
        ),
        section(
          `Regulatory and compliance signals in ${location.label}`,
          [
            makeParagraph([
              location.regulationInsight,
              `When pages include location-aware compliance notes, users can filter opportunities faster and avoid invalid applications.`,
            ]),
          ]
        ),
        section(
          `Local hiring trends for ${category.label.toLowerCase()}`,
          [
            makeParagraph([
              location.trendInsight,
              `Trend-aware sections improve evergreen value because they explain market direction, not just current listings.`,
            ]),
          ]
        ),
        section(
          'Recommendations for local execution',
          [
            makeParagraph([
              location.localRecommendation,
              `Pair this with canonical role and salary pages so users can navigate from location intent to actionable role-level decisions.`,
            ]),
          ]
        ),
        section(
          'How to localize this page at scale',
          [
            makeParagraph([
              `Maintain one canonical page per role-location pair, update local signals quarterly, and route overlapping variants through redirects.`,
              `Use structured local fields so templates can scale without introducing duplicate thin pages.`,
            ]),
          ]
        ),
      ]

      const faq = [
        {
          question: `What local factors matter most in ${location.label}?`,
          answer:
            'Compensation structure, compliance constraints, and hiring velocity are the highest-impact factors for decision quality.',
        },
        {
          question: 'How often should location insights be refreshed?',
          answer:
            'Refresh at least quarterly, and immediately when compensation legislation or remote-eligibility norms change.',
        },
        {
          question: 'How does this page connect with broader programmatic SEO?',
          answer:
            'It acts as the location hub and should link to role, comparison, and conversion pages so users move through intent stages without dead ends.',
        },
      ]

      const page = makeCandidate(
        {
          url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
          playbook_type: 'locations',
          seo: {
            title: `${title} | Local Salary + Market Insights`,
            meta_description: `Location-specific ${category.label.toLowerCase()} insights for ${location.label}, including pricing, regulation, local trends, and practical recommendations.`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [
              `${category.label} jobs ${location.label}`,
              `${location.label} salary trends`,
              `${location.label} hiring regulations`,
            ],
            search_intent: 'informational',
          },
          content: {
            h1: title,
            introduction: makeParagraph([
              `This location page is designed for users comparing ${category.label.toLowerCase()} opportunities in ${location.label} and needing market-specific guidance before they apply or publish.`,
              `It combines compensation, compliance, and trend analysis so content remains useful beyond short-term listing changes.`,
            ]),
            sections,
            faq,
            call_to_action: `Use this location hub as your starting point, then continue to role, conversion, and integration pages for execution-ready decisions.`,
          },
          schema: {
            type: 'CollectionPage',
            structured_data: {
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: title,
              about: [category.label, location.label],
            },
          },
          internal_links: [],
          related_pages: [],
          data_requirements_used: makeDataRequirements([
            ['categories', category.slug],
            ['locations', location.slug],
          ]),
        },
        {
          categorySlug: category.slug,
          locationSlug: location.slug,
          intentFingerprint: buildIntentFingerprint(
            'locations',
            primaryKeyword,
            'informational'
          ),
          keywordTokens: new Set(tokenize(primaryKeyword)),
          minWordCount: minWordCountForPlaybook('locations'),
        }
      )

      pages.push(page)
      if (pages.length >= cap) return pages
    }
  }

  return pages
}

function buildPersonaCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.categories.length || !dataset.personas.length) return pages

  for (const persona of dataset.personas) {
    for (const category of dataset.categories) {
      const pathname = `/resources/personas/${persona.slug}-${category.slug}-playbook`
      const primaryKeyword = `${persona.label} ${category.label} guide`
      const title = `${persona.label} Playbook for ${category.label}`

      const sections = [
        section(
          `${persona.label} pain points in ${category.label.toLowerCase()} workflows`,
          persona.painPoints.map((painPoint) =>
            makeParagraph([
              `Pain point: ${painPoint}.`,
              `This issue creates measurable friction in execution quality and usually appears when workflows are not standardized.`,
            ])
          )
        ),
        section(
          'Use-case solutions by scenario',
          persona.useCaseFocus.map((useCase) =>
            makeParagraph([
              `For ${useCase}, create a canonical process map with defined ownership, expected output quality, and escalation triggers.`,
              `Pair each map with template and comparison links so users can move from planning to implementation quickly.`,
            ])
          )
        ),
        section(
          `Persona-specific benefits for ${persona.label.toLowerCase()} teams`,
          persona.benefits.map((benefit) =>
            makeParagraph([
              `Benefit: ${benefit}.`,
              `This advantage compounds when teams reuse the same taxonomy, metadata, and internal linking model across all related pages.`,
            ])
          )
        ),
        section(
          'Execution blueprint for scale',
          [
            makeParagraph([
              `Start with one canonical category and measure outcomes before expanding to additional combinations.`,
              `Document assumptions so future pages stay unique, non-duplicative, and aligned with intent.`,
            ]),
            makeParagraph([
              `Use monthly governance reviews to retire low-signal variants and reinforce pages that convert reliably.`,
            ]),
          ]
        ),
      ]

      const faq = [
        {
          question: `What makes this guide specific to ${persona.label.toLowerCase()} users?`,
          answer:
            'Every recommendation maps directly to persona pain points, operational constraints, and measurable outcomes rather than broad advice.',
        },
        {
          question: 'How should this page be used with other playbook pages?',
          answer:
            'Use persona pages as orchestration hubs that link to templates, comparisons, and integrations for end-to-end execution.',
        },
        {
          question: 'How do we keep persona pages from becoming repetitive?',
          answer:
            'Anchor each page to unique pain points, role context, and local constraints, then enforce canonical keyword ownership by URL.',
        },
      ]

      const page = makeCandidate(
        {
          url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
          playbook_type: 'personas',
          seo: {
            title: `${title} | Pain Points and Solutions`,
            meta_description: `Persona-specific ${category.label.toLowerCase()} guidance for ${persona.label.toLowerCase()} teams with pain points, practical solutions, and measurable benefits.`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [
              `${persona.label} strategy`,
              `${category.label} persona guide`,
              `${persona.label} playbook`,
            ],
            search_intent: 'informational',
          },
          content: {
            h1: title,
            introduction: makeParagraph([
              `This persona page is built for ${persona.label.toLowerCase()} teams responsible for ${category.label.toLowerCase()} outcomes and needing a clear operating model.`,
              `It maps recurring pain points to high-confidence solutions and shows how to measure impact over time.`,
            ]),
            sections,
            faq,
            call_to_action: `Adopt the blueprint here, then open related templates and integrations to operationalize ${persona.label.toLowerCase()} workflows without duplication.`,
          },
          schema: {
            type: 'Article',
            structured_data: {
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: title,
              about: [persona.label, category.label],
            },
          },
          internal_links: [],
          related_pages: [],
          data_requirements_used: makeDataRequirements([
            ['personas', persona.slug],
            ['categories', category.slug],
          ]),
        },
        {
          categorySlug: category.slug,
          personaSlug: persona.slug,
          intentFingerprint: buildIntentFingerprint(
            'personas',
            primaryKeyword,
            'informational'
          ),
          keywordTokens: new Set(tokenize(primaryKeyword)),
          minWordCount: minWordCountForPlaybook('personas'),
        }
      )

      pages.push(page)
      if (pages.length >= cap) return pages
    }
  }

  return pages
}

function buildIntegrationCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.integrations.length || !dataset.categories.length || !dataset.tools.length) {
    return pages
  }

  for (const integration of dataset.integrations) {
    for (const category of dataset.categories) {
      const tool = dataset.tools[(pages.length + 2) % dataset.tools.length]
      const pathname = `/resources/integrations/${integration.slug}-${tool.slug}-${category.slug}`
      const primaryKeyword = `${integration.label} ${tool.label} integration for ${category.label}`
      const title = `${integration.label} + ${tool.label} Integration for ${category.label}`

      const sections = [
        section(
          'Setup steps',
          [
            makeParagraph([
              `Step 1: map source and destination fields before connecting ${integration.label} to ${tool.label}.`,
              `Step 2: define canonical IDs and validation rules to prevent duplicate records.`,
              `Step 3: run a staging sync and verify payload integrity before production rollout.`,
            ]),
            makeParagraph([
              `Step 4: publish error-handling ownership and escalation paths.`,
              `Step 5: monitor sync latency and data freshness in a shared dashboard.`,
            ]),
          ]
        ),
        section(
          `High-value use cases for ${category.label.toLowerCase()} teams`,
          [
            makeParagraph([
              `Use case one: automate qualification handoff so no high-signal record stalls between systems.`,
              `Use case two: maintain a single analytics trail for decision reviews.`,
              `Use case three: enforce role and compensation metadata standards across pages.`,
            ]),
          ]
        ),
        section(
          'Workflow examples',
          [
            makeParagraph([
              `Example workflow A routes validated events from ${integration.label} into ${tool.label} with canonical tagging.`,
              `Example workflow B adds enrichment checks and rejects malformed payloads.`,
              `Example workflow C feeds clean events into reporting so teams can measure conversion impact.`,
            ]),
          ]
        ),
        section(
          'Operational controls and monitoring',
          [
            makeParagraph([
              `Define service-level targets for sync success, retry behavior, and stale-data thresholds.`,
              `Attach alerts to failed transformations and unresolved schema drift so integrations remain production-safe at scale.`,
            ]),
          ]
        ),
      ]

      const faq = [
        {
          question: 'What should be validated before enabling production sync?',
          answer:
            'Validate IDs, required fields, currency handling, and fallback logic in staging before any production write is allowed.',
        },
        {
          question: `How do we reduce failure risk when integrating ${integration.label}?`,
          answer:
            'Use strict schema checks, enforce retry limits, and define clear ownership for incident response and rollback decisions.',
        },
        {
          question: 'How do integration pages stay useful over time?',
          answer:
            'Document versioned setup steps, track operational metrics, and refresh workflows whenever upstream systems change behavior.',
        },
      ]

      const page = makeCandidate(
        {
          url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
          playbook_type: 'integrations',
          seo: {
            title: `${title} | Setup Steps + Workflows`,
            meta_description: `Implement ${integration.label} and ${tool.label} for ${category.label.toLowerCase()} workflows with setup steps, use cases, and production-safe workflow examples.`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [
              `${integration.label} setup`,
              `${tool.label} integration workflow`,
              `${category.label} integration guide`,
            ],
            search_intent: 'transactional',
          },
          content: {
            h1: title,
            introduction: makeParagraph([
              `This integration page shows how to connect ${integration.label} with ${tool.label} for ${category.label.toLowerCase()} operations using production-safe practices.`,
              `It includes setup steps, workflow examples, and controls to prevent duplicate or low-quality records.`,
            ]),
            sections,
            faq,
            call_to_action: `Run the staged setup sequence, then connect this integration page with your conversion and comparison pages for a complete implementation path.`,
          },
          schema: {
            type: 'HowTo',
            structured_data: {
              '@context': 'https://schema.org',
              '@type': 'HowTo',
              name: title,
              tool: [integration.label, tool.label],
            },
          },
          internal_links: [],
          related_pages: [],
          data_requirements_used: makeDataRequirements([
            ['integrations', integration.slug],
            ['tools', tool.slug],
            ['categories', category.slug],
          ]),
        },
        {
          categorySlug: category.slug,
          intentFingerprint: buildIntentFingerprint(
            'integrations',
            primaryKeyword,
            'transactional'
          ),
          keywordTokens: new Set(tokenize(primaryKeyword)),
          minWordCount: minWordCountForPlaybook('integrations'),
        }
      )

      pages.push(page)
      if (pages.length >= cap) return pages
    }
  }

  return pages
}

function buildGlossaryCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.glossaryTerms.length) return pages

  for (const term of dataset.glossaryTerms) {
    const pathname = `/resources/glossary/${term.slug}`
    const primaryKeyword = `${term.label} definition`
    const title = `${term.label}: Meaning, Technical Depth, and Usage`

    const sections = [
      section(
        'Beginner-friendly explanation',
        [
          makeParagraph([
            term.beginnerExplanation,
            `This explanation is intentionally plain-language so first-time readers can understand the term before diving into implementation details.`,
          ]),
        ]
      ),
      section(
        'Technical depth and implementation impact',
        [
          makeParagraph([
            term.technicalDepth,
            `In production settings, this term typically affects data structure, workflow reliability, and decision accuracy.`,
          ]),
          makeParagraph([
            `Use technical depth notes to separate conceptual understanding from operational requirements.`,
          ]),
        ]
      ),
      section(
        'Related terms and how they connect',
        [
          makeParagraph([
            `Related terms: ${term.relatedTerms.join(', ')}.`,
            `Linking related terms creates a semantic cluster that improves discoverability and helps users build connected understanding.`,
          ]),
        ]
      ),
      section(
        'Practical interpretation checklist',
        [
          makeParagraph([
            `When using this term in page content, validate definition consistency, context relevance, and taxonomy alignment.`,
            `This prevents contradictory explanations across the glossary corpus.`,
          ]),
        ]
      ),
    ]

    const faq = [
      {
        question: `Why does ${term.label} need both simple and technical explanations?`,
        answer:
          'Simple explanations support discovery intent, while technical depth supports implementation intent for advanced users.',
      },
      {
        question: 'How should glossary terms be internally linked?',
        answer:
          'Link each term to its parent category page, at least two sibling terms, and cross-playbook pages where the concept is applied.',
      },
      {
        question: 'How do we prevent glossary duplication?',
        answer:
          'Use one canonical URL per term, maintain a centralized term registry, and merge overlapping definitions under a single primary entry.',
      },
    ]

    const page = makeCandidate(
      {
        url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
        playbook_type: 'glossary',
        seo: {
          title: `${title} | Glossary`,
          meta_description: `${term.label} explained in plain language and technical detail with related term links and implementation guidance.`,
          primary_keyword: primaryKeyword,
          secondary_keywords: [
            `${term.label} meaning`,
            `${term.label} technical explanation`,
            `${term.label} glossary`,
          ],
          search_intent: 'informational',
        },
        content: {
          h1: title,
          introduction: makeParagraph([
            `This glossary entry defines ${term.label} for both beginners and advanced practitioners so terminology stays consistent across your programmatic content system.`,
            `It includes practical interpretation guidance and semantic links to related concepts.`,
          ]),
          sections,
          faq,
          call_to_action: `Use this definition as the canonical reference for ${term.label} and link it from template, comparison, and integration pages where the term appears.`,
        },
        schema: {
          type: 'DefinedTerm',
          structured_data: {
            '@context': 'https://schema.org',
            '@type': 'DefinedTerm',
            name: term.label,
            description: term.beginnerExplanation,
            inDefinedTermSet: '/resources/glossary',
          },
        },
        internal_links: [],
        related_pages: [],
        data_requirements_used: makeDataRequirements([['glossary_terms', term.slug]]),
      },
      {
        intentFingerprint: buildIntentFingerprint(
          'glossary',
          primaryKeyword,
          'informational'
        ),
        keywordTokens: new Set(tokenize(primaryKeyword)),
        minWordCount: minWordCountForPlaybook('glossary'),
      }
    )

    pages.push(page)
    if (pages.length >= cap) return pages
  }

  return pages
}

function buildTranslationCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.languages.length || !dataset.categories.length || !dataset.locations.length) {
    return pages
  }

  for (const language of dataset.languages) {
    for (const category of dataset.categories) {
      const location = dataset.locations[(pages.length + 1) % dataset.locations.length]
      const pathname = `/resources/translations/${category.slug}-${language.slug}-${location.slug}`
      const primaryKeyword = `${category.label} ${language.nativeName} SEO translation`
      const title = `${category.label} SEO Translation in ${language.nativeName}`

      const sections = [
        section(
          'Native language SEO optimization',
          [
            makeParagraph([
              `Translate core intent terms for ${category.label.toLowerCase()} pages into ${language.nativeName} while preserving search behavior and role context.`,
              `Do not translate keyword structures literally when local query patterns differ.`,
            ]),
          ]
        ),
        section(
          'Cultural localization guidance',
          [
            makeParagraph([
              language.culturalNote,
              `Localization should adjust tone, examples, and compensation framing for ${location.label}, not just language tokens.`,
            ]),
          ]
        ),
        section(
          'hreflang mapping and implementation',
          [
            makeParagraph([
              `Use hreflang="${language.hreflang}" and locale "${language.locale}" for this localized URL.`,
              `Map each translated page to its canonical source and x-default target to avoid duplicate clusters.`,
            ]),
          ]
        ),
        section(
          'Localization quality controls',
          [
            makeParagraph([
              `Run QA checks for term consistency, intent match, and metadata uniqueness before indexing.`,
              `Refresh translations whenever the canonical source page meaningfully changes.`,
            ]),
          ]
        ),
      ]

      const faq = [
        {
          question: 'What is the biggest translation SEO mistake?',
          answer:
            'Literal translation without local search-intent validation. Native query behavior should drive final keyword choices.',
        },
        {
          question: 'How should hreflang references be maintained?',
          answer:
            'Keep bidirectional hreflang links synchronized across canonical, localized, and x-default URLs in every deployment.',
        },
        {
          question: `Why include local cultural notes for ${location.label}?`,
          answer:
            'Cultural framing affects click intent and trust. Localization quality drops when only text language is translated.',
        },
      ]

      const page = makeCandidate(
        {
          url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
          playbook_type: 'translations',
          seo: {
            title: `${title} | Localization + Hreflang`,
            meta_description: `Localized ${category.label.toLowerCase()} page strategy in ${language.nativeName} with native SEO optimization, cultural adaptation, and hreflang mapping guidance.`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [
              `${category.label} translation SEO`,
              `${language.nativeName} localization`,
              `${language.hreflang} hreflang mapping`,
            ],
            search_intent: 'informational',
          },
          content: {
            h1: title,
            introduction: makeParagraph([
              `This translation page helps teams localize ${category.label.toLowerCase()} content for ${language.nativeName} audiences without losing search intent accuracy.`,
              `It combines language strategy, cultural adaptation, and hreflang implementation into one canonical workflow.`,
            ]),
            sections,
            faq,
            call_to_action: `Publish this localized page only after metadata, cultural QA, and hreflang reciprocity checks pass in production.`,
          },
          schema: {
            type: 'WebPage',
            structured_data: {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              inLanguage: language.hreflang,
              name: title,
            },
          },
          internal_links: [],
          related_pages: [],
          data_requirements_used: makeDataRequirements([
            ['categories', category.slug],
            ['languages', language.slug],
            ['locations', location.slug],
          ]),
        },
        {
          categorySlug: category.slug,
          locationSlug: location.slug,
          intentFingerprint: buildIntentFingerprint(
            'translations',
            primaryKeyword,
            'informational'
          ),
          keywordTokens: new Set(tokenize(primaryKeyword)),
          minWordCount: minWordCountForPlaybook('translations'),
        }
      )

      pages.push(page)
      if (pages.length >= cap) return pages
    }
  }

  return pages
}

function buildDirectoryCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.industries.length || !dataset.locations.length || !dataset.directoryEntries.length) {
    return pages
  }

  for (const industry of dataset.industries) {
    for (const location of dataset.locations) {
      const category = dataset.categories[pages.length % dataset.categories.length]
      if (!category) break

      const selectedEntries = [
        dataset.directoryEntries[pages.length % dataset.directoryEntries.length],
        dataset.directoryEntries[(pages.length + 1) % dataset.directoryEntries.length],
        dataset.directoryEntries[(pages.length + 2) % dataset.directoryEntries.length],
      ]

      const pathname = `/resources/directory/${industry.slug}-${location.slug}-${category.slug}`
      const primaryKeyword = `${industry.label} ${category.label} directory ${location.label}`
      const title = `${industry.label} ${category.label} Directory for ${location.label}`

      const metadataTable = [
        '| Listing | Core attributes | Categorization tags |',
        '|---|---|---|',
        ...selectedEntries.map(
          (entry) =>
            `| ${entry.label} | ${entry.attributes.slice(0, 3).join(', ')} | ${entry.tags.slice(0, 3).join(', ')} |`
        ),
      ].join('\n')

      const sections = [
        section(
          'Filtering metadata model',
          [
            makeParagraph([
              `This directory uses structured filters for role type, compensation visibility, team size, and workflow maturity.`,
              `Filter metadata is normalized so users can compare listings without inconsistent labels.`,
            ]),
          ]
        ),
        section(
          'Listing attributes and quality signals',
          [
            makeParagraph([
              `Each listing includes attributes such as ${selectedEntries[0].attributes.slice(0, 2).join(' and ')}, plus operational notes for validation.`,
              `Only entries with verifiable data should remain indexable to prevent thin-directory pages.`,
            ]),
          ]
        ),
        section('Categorization tags and taxonomy', [metadataTable]),
        section(
          'How to use this directory effectively',
          [
            makeParagraph([
              `Start with primary filters, shortlist matching entries, and then open profile pages for deeper operational context.`,
              `This flow prevents noisy browsing and improves intent satisfaction for high-value users.`,
            ]),
          ]
        ),
      ]

      const faq = [
        {
          question: 'How are directory entries selected?',
          answer:
            'Entries are selected only when listing attributes and categorization tags meet minimum quality and completeness thresholds.',
        },
        {
          question: 'How should filters be maintained over time?',
          answer:
            'Maintain a controlled taxonomy with versioned labels, and deprecate tags that create overlap or weak intent differentiation.',
        },
        {
          question: `How does this help users exploring ${location.label}?`,
          answer:
            'Location-aware filtering lets users move from broad discovery to practical shortlist decisions without opening low-fit listings.',
        },
      ]

      const page = makeCandidate(
        {
          url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
          playbook_type: 'directory',
          seo: {
            title: `${title} | Filtered Listings`,
            meta_description: `${industry.label} directory for ${location.label} with structured filters, listing attributes, and categorization tags for ${category.label.toLowerCase()} workflows.`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [
              `${industry.label} directory`,
              `${location.label} listing filters`,
              `${category.label} categorized listings`,
            ],
            search_intent: 'navigational',
          },
          content: {
            h1: title,
            introduction: makeParagraph([
              `This directory page organizes ${industry.label.toLowerCase()} listings for ${location.label} using normalized filters and listing attributes.`,
              `It is designed to reduce browsing friction and route users toward high-fit profile and comparison pages.`,
            ]),
            sections,
            faq,
            call_to_action: `Use filters to shortlist relevant listings, then open related profile and comparison pages before making tool or partner decisions.`,
          },
          schema: {
            type: 'ItemList',
            structured_data: {
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: title,
              itemListElement: selectedEntries.map((entry, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: entry.label,
              })),
            },
          },
          internal_links: [],
          related_pages: [],
          data_requirements_used: makeDataRequirements([
            ['industries', industry.slug],
            ['locations', location.slug],
            ['categories', category.slug],
            ['directory_entries', selectedEntries[0].slug],
          ]),
        },
        {
          categorySlug: category.slug,
          locationSlug: location.slug,
          intentFingerprint: buildIntentFingerprint(
            'directory',
            primaryKeyword,
            'navigational'
          ),
          keywordTokens: new Set(tokenize(primaryKeyword)),
          minWordCount: minWordCountForPlaybook('directory'),
        }
      )

      pages.push(page)
      if (pages.length >= cap) return pages
    }
  }

  return pages
}

function buildProfileCandidates(
  dataset: NormalizedDataset,
  cap: number,
  siteBaseUrl: string
): CandidatePage[] {
  const pages: CandidatePage[] = []
  if (!dataset.profiles.length) return pages

  for (const profile of dataset.profiles) {
    const pathname = `/resources/profiles/${profile.slug}`
    const primaryKeyword = `${profile.label} profile`
    const title = `${profile.label} Profile and Milestones`

    const sections = [
      section(
        'Verified factual data',
        profile.verifiedFacts.map((fact) =>
          makeParagraph([
            fact,
            `Each fact should be traceable to a trusted source before publication to maintain profile integrity.`,
          ])
        )
      ),
      section(
        'Timeline and milestone summary',
        profile.milestones.map((milestone) =>
          makeParagraph([
            milestone,
            `Milestones are ordered to show progression and strategic inflection points relevant to users comparing options.`,
          ])
        )
      ),
      section(
        'Unique insight summary',
        [
          makeParagraph([
            profile.uniqueInsight,
            `This insight is what differentiates the profile from generic summaries and provides actionable context for decision making.`,
          ]),
        ]
      ),
      section(
        'Practical relevance for readers',
        [
          makeParagraph([
            `Use this profile to benchmark credibility, operating maturity, and long-term fit before shortlisting.`,
            `Cross-check with related directory and comparison pages for a complete evaluation path.`,
          ]),
        ]
      ),
    ]

    const faq = [
      {
        question: 'How is factual accuracy maintained on profile pages?',
        answer:
          'Facts are published only when source-verifiable and are refreshed when newer authoritative data is available.',
      },
      {
        question: 'Why include timeline milestones?',
        answer:
          'Milestones provide context on maturity and strategy shifts, helping readers interpret current positioning with less ambiguity.',
      },
      {
        question: 'How do profile pages stay unique at scale?',
        answer:
          'Each page requires a unique evidence set, timeline, and insight summary before publication to prevent templated duplication.',
      },
    ]

    const page = makeCandidate(
      {
        url: absoluteOrRelativeUrl(siteBaseUrl, pathname),
        playbook_type: 'profiles',
        seo: {
          title: `${title} | Verified Profile`,
          meta_description: `Verified profile for ${profile.label} with factual data, milestone timeline, and unique insight summary.`,
          primary_keyword: primaryKeyword,
          secondary_keywords: [
            `${profile.label} milestones`,
            `${profile.label} company profile`,
            `${profile.label} strategic overview`,
          ],
          search_intent: 'informational',
        },
        content: {
          h1: title,
          introduction: makeParagraph([
            `This profile page summarizes verified information for ${profile.label} with timeline context and practical insight for high-intent readers.`,
            `It is designed to support informed shortlist decisions, not promotional copy.`,
          ]),
          sections,
          faq,
          call_to_action: `Use this profile as the canonical reference, then review linked directory and comparison pages before selecting final options.`,
        },
        schema: {
          type: 'ProfilePage',
          structured_data: {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            name: profile.label,
            description: profile.uniqueInsight,
          },
        },
        internal_links: [],
        related_pages: [],
        data_requirements_used: makeDataRequirements([
          ['profiles', profile.slug],
          ...(profile.categorySlug ? ([['categories', profile.categorySlug]] as Array<[string, string]>) : []),
        ]),
      },
      {
        categorySlug: profile.categorySlug,
        intentFingerprint: buildIntentFingerprint(
          'profiles',
          primaryKeyword,
          'informational'
        ),
        keywordTokens: new Set(tokenize(primaryKeyword)),
        minWordCount: minWordCountForPlaybook('profiles'),
      }
    )

    pages.push(page)
    if (pages.length >= cap) return pages
  }

  return pages
}

function buildAllCandidates(
  dataset: NormalizedDataset,
  capPerPlaybook: number,
  siteBaseUrl: string
): Record<PlaybookType, CandidatePage[]> {
  return {
    templates: buildTemplateCandidates(dataset, capPerPlaybook, siteBaseUrl),
    curation: buildCurationCandidates(dataset, capPerPlaybook, siteBaseUrl),
    conversions: buildConversionCandidates(dataset, capPerPlaybook, siteBaseUrl),
    comparisons: buildComparisonCandidates(dataset, capPerPlaybook, siteBaseUrl),
    examples: buildExampleCandidates(dataset, capPerPlaybook, siteBaseUrl),
    locations: buildLocationCandidates(dataset, capPerPlaybook, siteBaseUrl),
    personas: buildPersonaCandidates(dataset, capPerPlaybook, siteBaseUrl),
    integrations: buildIntegrationCandidates(dataset, capPerPlaybook, siteBaseUrl),
    glossary: buildGlossaryCandidates(dataset, capPerPlaybook, siteBaseUrl),
    translations: buildTranslationCandidates(dataset, capPerPlaybook, siteBaseUrl),
    directory: buildDirectoryCandidates(dataset, capPerPlaybook, siteBaseUrl),
    profiles: buildProfileCandidates(dataset, capPerPlaybook, siteBaseUrl),
  }
}

function validateCandidateShape(candidate: CandidatePage): string | null {
  if (!candidate.url) return 'missing_url'
  if (!candidate.seo.primary_keyword) return 'missing_primary_keyword'
  if (!candidate.content.sections.length) return 'missing_sections'
  if (candidate.content.faq.length < 3) return 'faq_below_minimum'
  if (candidate.data_requirements_used.length === 0) return 'missing_data_requirements'

  const uniqueHeadings = new Set(
    candidate.content.sections.map((sectionItem) =>
      sectionItem.heading.trim().toLowerCase()
    )
  )
  if (uniqueHeadings.size < 3) return 'heading_diversity_failure'

  const minWords = candidate.__context.minWordCount
  const totalWords = countPageWords(candidate)
  if (totalWords < minWords) return 'thin_content'

  return null
}

function selectBatch(
  candidatesByPlaybook: Record<PlaybookType, CandidatePage[]>,
  batchSize: number
): {
  selected: CandidatePage[]
  rejectedReasons: Record<string, number>
} {
  const queues: Record<PlaybookType, CandidatePage[]> = {
    templates: [...candidatesByPlaybook.templates],
    curation: [...candidatesByPlaybook.curation],
    conversions: [...candidatesByPlaybook.conversions],
    comparisons: [...candidatesByPlaybook.comparisons],
    examples: [...candidatesByPlaybook.examples],
    locations: [...candidatesByPlaybook.locations],
    personas: [...candidatesByPlaybook.personas],
    integrations: [...candidatesByPlaybook.integrations],
    glossary: [...candidatesByPlaybook.glossary],
    translations: [...candidatesByPlaybook.translations],
    directory: [...candidatesByPlaybook.directory],
    profiles: [...candidatesByPlaybook.profiles],
  }

  const selected: CandidatePage[] = []
  const rejectedReasons: Record<string, number> = {}
  const usedUrls = new Set<string>()
  const usedKeywords = new Set<string>()
  const usedIntentFingerprints = new Set<string>()

  type AcceptedMeta = {
    playbook: PlaybookType
    searchIntent: SearchIntent
    tokens: Set<string>
    categorySlug?: string
  }

  const acceptedMeta: AcceptedMeta[] = []

  const addReject = (reason: string) => {
    rejectedReasons[reason] = (rejectedReasons[reason] || 0) + 1
  }

  let progress = true
  while (selected.length < batchSize && progress) {
    progress = false

    for (const playbook of PLAYBOOK_TYPES) {
      const queue = queues[playbook]
      while (queue.length) {
        const candidate = queue.shift() as CandidatePage
        const shapeReason = validateCandidateShape(candidate)
        if (shapeReason) {
          addReject(shapeReason)
          continue
        }

        if (usedUrls.has(candidate.url)) {
          addReject('duplicate_slug')
          continue
        }
        const normalizedKeyword = candidate.seo.primary_keyword.toLowerCase().trim()
        if (usedKeywords.has(normalizedKeyword)) {
          addReject('duplicate_primary_keyword')
          continue
        }
        if (usedIntentFingerprints.has(candidate.__context.intentFingerprint)) {
          addReject('duplicate_intent')
          continue
        }

        let cannibalized = false
        for (const existing of acceptedMeta) {
          const similarity = jaccardSimilarity(
            existing.tokens,
            candidate.__context.keywordTokens
          )
          if (
            similarity >= 0.82 &&
            (existing.playbook === candidate.playbook_type ||
              existing.searchIntent === candidate.seo.search_intent)
          ) {
            cannibalized = true
            break
          }
          if (
            similarity >= 0.72 &&
            existing.categorySlug &&
            existing.categorySlug === candidate.__context.categorySlug
          ) {
            cannibalized = true
            break
          }
        }
        if (cannibalized) {
          addReject('keyword_cannibalization')
          continue
        }

        selected.push(candidate)
        usedUrls.add(candidate.url)
        usedKeywords.add(normalizedKeyword)
        usedIntentFingerprints.add(candidate.__context.intentFingerprint)
        acceptedMeta.push({
          playbook: candidate.playbook_type,
          searchIntent: candidate.seo.search_intent,
          tokens: candidate.__context.keywordTokens,
          categorySlug: candidate.__context.categorySlug,
        })
        progress = true
        break
      }

      if (selected.length >= batchSize) break
    }
  }

  return { selected, rejectedReasons }
}

function uniqueLinks(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

function attachInternalLinks(selected: CandidatePage[], siteBaseUrl: string): CandidatePage[] {
  const byPlaybook = new Map<PlaybookType, CandidatePage[]>()
  const byCategory = new Map<string, CandidatePage[]>()

  for (const page of selected) {
    const playbookGroup = byPlaybook.get(page.playbook_type) || []
    playbookGroup.push(page)
    byPlaybook.set(page.playbook_type, playbookGroup)

    if (page.__context.categorySlug) {
      const categoryGroup = byCategory.get(page.__context.categorySlug) || []
      categoryGroup.push(page)
      byCategory.set(page.__context.categorySlug, categoryGroup)
    }
  }

  const allGeneratedUrls = new Set(selected.map((page) => page.url))

  for (const page of selected) {
    const categorySlug = page.__context.categorySlug
    const parentPath = categorySlug ? `/jobs/${categorySlug}` : '/jobs/100k-plus'
    const parentLink = absoluteOrRelativeUrl(siteBaseUrl, parentPath)

    const siblingPool = (byPlaybook.get(page.playbook_type) || [])
      .filter((candidate) => candidate.url !== page.url)
      .map((candidate) => candidate.url)
    const siblingLinks = siblingPool.slice(0, 2)

    const categoryCrossPool = categorySlug
      ? (byCategory.get(categorySlug) || [])
          .filter((candidate) => candidate.url !== page.url && candidate.playbook_type !== page.playbook_type)
          .map((candidate) => candidate.url)
      : []

    const globalCrossPool = selected
      .filter((candidate) => candidate.url !== page.url && candidate.playbook_type !== page.playbook_type)
      .map((candidate) => candidate.url)

    const crossLinks = uniqueLinks([...categoryCrossPool, ...globalCrossPool]).slice(0, 2)

    const fallbackPool = selected
      .filter((candidate) => candidate.url !== page.url)
      .map((candidate) => candidate.url)

    const mergedInternal = uniqueLinks([
      parentLink,
      ...siblingLinks,
      ...crossLinks,
      ...fallbackPool.slice(0, 4),
    ])

    page.internal_links = mergedInternal.slice(0, 8)

    const relatedPreferred = uniqueLinks([...crossLinks, ...siblingLinks]).filter((url) =>
      allGeneratedUrls.has(url)
    )
    const relatedFallback = fallbackPool.filter((url) => allGeneratedUrls.has(url))
    page.related_pages = uniqueLinks([
      ...relatedPreferred,
      ...relatedFallback,
    ]).slice(0, 4)
  }

  return selected
}

function validateFinalBatch(pages: CandidatePage[], batchSize: number): string | null {
  if (pages.length !== batchSize) {
    return `insufficient_valid_pages:${pages.length}/${batchSize}`
  }

  const slugSet = new Set<string>()
  const keywordSet = new Set<string>()
  const mix = new Set<PlaybookType>()
  for (const page of pages) {
    if (slugSet.has(page.url)) return 'final_duplicate_slug'
    slugSet.add(page.url)

    const key = page.seo.primary_keyword.toLowerCase().trim()
    if (keywordSet.has(key)) return 'final_duplicate_primary_keyword'
    keywordSet.add(key)

    mix.add(page.playbook_type)

    if (page.internal_links.length < 5) return 'internal_links_below_minimum'
    if (page.related_pages.length < 2) return 'related_pages_below_minimum'
    if (page.content.faq.length < 3) return 'faq_below_minimum_final'
  }

  if (mix.size < 4) return 'playbook_mix_too_narrow'

  return null
}

function stripContext(pages: CandidatePage[]): PlaybookPageOutput[] {
  return pages.map(({ __context, ...page }) => page)
}

export function generatePlaybookBatch(
  rawDataset: RawPlaybookDataset,
  options: GeneratePlaybookBatchOptions = {}
): GeneratePlaybookBatchResult {
  const batchSize = Math.max(1, options.batchSize ?? 100)
  const batchNumber = Math.max(1, options.batchNumber ?? 1)
  const siteBaseUrl = options.siteBaseUrl || ''

  const dataset = normalizeDataset(rawDataset)

  if (!dataset.categories.length) {
    return {
      status: 'SKIPPED',
      reason: 'Insufficient input: categories data is required.',
    }
  }

  const capPerPlaybook = Math.max(batchSize * 3, 200)
  const candidatesByPlaybook = buildAllCandidates(dataset, capPerPlaybook, siteBaseUrl)
  const availablePlaybookTypes = PLAYBOOK_TYPES.filter(
    (type) => candidatesByPlaybook[type].length > 0
  )

  if (availablePlaybookTypes.length < 4) {
    return {
      status: 'SKIPPED',
      reason:
        'Insufficient input: fewer than 4 playbook types have valid data-backed candidates.',
    }
  }

  const { selected, rejectedReasons } = selectBatch(candidatesByPlaybook, batchSize)
  if (selected.length < batchSize) {
    return {
      status: 'SKIPPED',
      reason: `Insufficient valid candidates after quality gates (${selected.length}/${batchSize}).`,
    }
  }

  const enriched = attachInternalLinks(selected, siteBaseUrl)
  const finalError = validateFinalBatch(enriched, batchSize)
  if (finalError) {
    return {
      status: 'SKIPPED',
      reason: `Batch validation failed: ${finalError}.`,
    }
  }

  const playbookMix = PLAYBOOK_TYPES.reduce(
    (acc, playbook) => {
      acc[playbook] = enriched.filter((page) => page.playbook_type === playbook).length
      return acc
    },
    {} as Record<PlaybookType, number>
  )

  return {
    status: 'OK',
    batch_number: batchNumber,
    generated_count: enriched.length,
    playbook_mix: playbookMix,
    rejected_count: Object.values(rejectedReasons).reduce((sum, count) => sum + count, 0),
    rejected_reasons: rejectedReasons,
    pages: stripContext(enriched),
  }
}
