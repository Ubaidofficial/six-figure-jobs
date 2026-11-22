// lib/trends/titleArea.ts
//
// The area a job belongs to, read from its title, for the "Hiring by area" table on /trends. The role we store for a job is
// `other` for most jobs (the ingest only keeps a role slug that is canonical as written), so the stored role alone placed about
// 14% of the jobs (measured on production, 2026-11-22). A title says more, but words are ambiguous ("Sales Engineer",
// "Product Marketing Manager", "Data Engineer", "Support Engineer"), so this is a short ORDERED list: the first rule that matches
// wins, and the specific phrases come before the general words (an engineer in sales is in Sales; "engineer" alone is Engineering).
// A title that no rule is sure about stays "other" rather than being guessed. The rules were tuned on 711 real titles from the live
// listings and are pinned by __tests__/trends/titleArea.test.ts: change a rule only together with a test title that shows why.

export const TITLE_AREAS = ['engineering', 'product', 'design', 'data', 'sales', 'marketing', 'customer', 'operations', 'finance', 'people', 'legal', 'healthcare'] as const
export type TitleArea = (typeof TITLE_AREAS)[number]

export const TITLE_AREA_LABELS: Record<TitleArea, string> = {
  engineering: 'Engineering',
  product: 'Product',
  design: 'Design',
  data: 'Data & AI',
  sales: 'Sales',
  marketing: 'Marketing',
  customer: 'Customer success & support',
  operations: 'Operations',
  finance: 'Finance',
  people: 'People & recruiting',
  legal: 'Legal & compliance',
  healthcare: 'Healthcare & clinical',
}

type Rule = [TitleArea, RegExp]

// Matched against the lower-case title with punctuation turned into spaces, so \b works on every word.
const RULES: Rule[] = [
  ['legal', /\b(counsel|attorney|paralegal|legal|lawyer|litigation|regulatory affairs)\b/],
  // Clinical roles first: their nouns are specific, and nothing below is confused by them.
  ['healthcare', /\b(nurse|nursing|physician|dentist|dental|veterinarian|veterinary|pharmacist|pharmacy|pharmacovigilance|therapist|perfusionist|surgeon|anesthesiologist|radiologist|clinician|patient|advanced practice provider|clinical documentation|home health|\w*arzt\w*|arbeitsmedizin|psychologist|counselor|field medical|medical (director|affairs|science liaison|officer)|clinical (research|trial|specialist|director|manager|pharmacist|nurse))\b/],
  ['people', /\b(recruiter|recruiting|recruitment|talent acquisition|talent partner|sourcer|human resources|hr|hrbp|people partner|people operations|people ops|people business partner|total rewards|compensation (manager|analyst|director|partner|specialist)|employee experience|learning and development|benefits partner|benefits manager|benefits specialist)\b/],
  ['finance', /\b(accountant|accounting|controller|bookkeeper|fp and a|fpa|financial|finance|treasury|tax|auditor|audit|payroll|accounts payable|accounts receivable|investor relations|underwriter|actuary|actuarial|credit analyst|mergers and acquisitions|fiscal|budget analyst|cfo|chief financial|treasurer)\b/],
  ['marketing', /\b(marketing|marketer|seo|sem|copywriter|brand|communications|public relations|social media|demand gen|demand generation|lifecycle|community manager|content strategist|content writer|content manager|influencer|events? manager|events|event marketing|growth manager|head of growth|vp of growth|vp growth|vice president of growth|growth lead|paid media|paid search|paid social|head of copy|content lead|content creator|community)\b/],
  // Pre-sales solutions engineers are Sales; a "Solutions Architect" is not placed here (it is as often an internal IT role), so it
  // falls to the general architect rule below. The general engineer rule is further down.
  ['sales', /\b(sales|account executive|account exec|(?<!technical )account manager|business development|bdr|sdr|pre sales|presales|solutions engineer|solution engineer|solutions consultant|forward deployed account|partnerships? manager|channel manager|head of channel|channels|field force|account director|territory manager|regional (account|sales) manager|alliance manager)\b/],
  ['customer', /\b(customer success|customer support|customer service|customer experience|client success|client services|support engineer|support specialist|support agent|support representative|support analyst|support manager|technical support|technical account manager|implementation|onboarding|help desk|service desk|csm)\b/],
  // Security work is engineering, and must be decided before "operations" and "analyst" below.
  ['engineering', /\b(security (engineer|engineering|analyst|architect|architecture|operations|manager|officer|researcher|consultant|specialist|lead|director)|information security|information systems? security|cybersecurity|cyber|infosec|appsec|ciso|soc analyst|(system|systems|network|database|linux|cloud) administrator|sysadmin|incident (response|management)|forensics|threat (intelligence|hunter|analyst)|vulnerability|penetration|pentest)\b/],
  // Design and Product come before Data and Engineering: a "Product Designer" or "Data Product Manager" is not data or engineering work.
  ['design', /\b(designer|ux|ui ux|user experience|user interface|product design|graphic|visual design|interaction design|brand design|creative director|art director|design lead|design manager|design director|head of design|vp of design|illustrator|animator|motion)\b/],
  ['product', /\b(product manager|product owner|product management|product lead|product director|product operations|head of product|vp of product|vp product|chief product|group product|principal product|technical product|director of product|product strategy)\b/],
  ['data', /\b(data|machine learning|ml|ai|artificial intelligence|llm|nlp|computer vision|deep learning|analytics|business intelligence|research scientist|applied scientist|quantitative|statistician)\b/],
  // Engineering before Operations, so a "Quality Engineer" or "Supply Chain Software Engineer" is Engineering (an engineer is an engineer),
  // while a "Technical Program Manager" or "Supply Chain Manager" has no engineer word and falls through to Operations.
  ['engineering', /\b(engineer|engineering|developer|software|sde|swe|sre|devops|devsecops|mlops|architects?|programmer|firmware|embedded|backend|frontend|front end|full stack|fullstack|platform|infrastructure|cto|chief technology officer|tech lead|technical lead|technologist|architecture|member of technical staff|java|python|golang|typescript|javascript|kubernetes|aws|azure|gcp|erp|it specialist|database administration|technology manager|technology lead|application specialist|enterprise applications)\b/],
  ['operations', /\b(operations|ops|supply chain|logistics|procurement|sourcing|purchasing|buyer|planner|planning|facilities|warehouse|fulfillment|program manager|project manager|program management|project management|program and project|programme|chief of staff|strategy|business partner|administrative|executive assistant|office manager|workplace|real estate|manufacturing|production|quality|safety|technician|operator|mechanic|installer|inspector|dispatcher|coordinator)\b/],
  ['legal', /\b(compliance)\b/],
  // A bare "analyst" that no rule above placed reads as data work.
  ['data', /\b(analyst)\b/],
]

// "Upstart: Director of Product" and "ZoomInfo Technologies LLC: Principal Software Engineer" carry the employer in front.
const EMPLOYER_PREFIX = /^[^:,]{2,60}:\s+(?=\S)/

/** A title in its parts: "Engineering Manager, Maps" -> ["engineering manager", "maps"]. */
function segments(title: string): string[] {
  return title.split(/\s[-–—|]\s|[,(]/).map(words).filter(Boolean)
}

// Accents are dropped first, so "Fachärztin" reads as "facharztin" (the German doctor stems are matched in the healthcare rule).
const words = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()

function firstArea(text: string): TitleArea | null {
  for (const [area, re] of RULES) if (re.test(text)) return area
  return null
}

/**
 * The area of a job title, or null when no rule is sure. The title is read part by part, left to right (parts end at a comma,
 * a bracket or a spaced dash), and the first part that matches a rule decides: the work comes first and the team after it
 * ("Software Engineer, Finance Systems" is Engineering), but a title that opens with only a level reads on ("Director, Data
 * Science & Engineering, Finance" is Data, "Manager, Sales Compensation" is Sales).
 */
export function areaOfTitle(title: string | null | undefined): TitleArea | null {
  const full = String(title ?? '').trim()
  // Only a short prefix is an employer: "Senior Staff SRE, Architecture Engineering: Hosted Runners" is a title with a team after it.
  const raw = EMPLOYER_PREFIX.test(full) && full.split(':')[0].trim().split(/\s+/).length <= 5 ? full.replace(EMPLOYER_PREFIX, '').trim() : full
  for (const part of segments(raw)) {
    const area = firstArea(part)
    if (area) return area
  }
  return null
}
