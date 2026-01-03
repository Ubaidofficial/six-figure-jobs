import slugify from 'slugify'

type TechPattern = {
  name: string
  slug?: string
  re: RegExp
}

const TECH_PATTERNS: TechPattern[] = [
  // Languages
  { name: 'TypeScript', re: /\btypescript\b/i },
  { name: 'JavaScript', re: /\bjavascript\b/i },
  { name: 'Python', re: /\bpython\b/i },
  { name: 'Java', re: /\bjava\b/i },
  { name: 'Go', slug: 'go', re: /\bgo(lang)?\b/i },
  { name: 'Rust', re: /\brust\b/i },
  { name: 'Ruby', re: /\bruby\b/i },
  { name: 'PHP', slug: 'php', re: /\bphp\b/i },
  { name: 'C#', slug: 'csharp', re: /\bc#\b/i },
  { name: 'C++', slug: 'cpp', re: /\bc\+\+\b/i },
  { name: '.NET', slug: 'dotnet', re: /\b\.net\b|\bdotnet\b/i },
  { name: 'Swift', re: /\bswift\b/i },
  { name: 'Kotlin', re: /\bkotlin\b/i },

  // Frontend
  { name: 'React', re: /\breact\b/i },
  { name: 'Next.js', slug: 'nextjs', re: /\bnext\.?js\b/i },
  { name: 'Vue', re: /\bvue(\.js)?\b/i },
  { name: 'Angular', re: /\bangular\b/i },
  { name: 'Svelte', re: /\bsvelte\b/i },
  { name: 'Tailwind', re: /\btailwind\b/i },
  { name: 'React Native', slug: 'react-native', re: /\breact\s+native\b/i },
  { name: 'Flutter', re: /\bflutter\b/i },

  // Backend / frameworks
  { name: 'Node.js', slug: 'nodejs', re: /\bnode(\.js)?\b/i },
  { name: 'Express', re: /\bexpress\b/i },
  { name: 'NestJS', slug: 'nestjs', re: /\bnestjs\b|\bnest\s?js\b/i },
  { name: 'Django', re: /\bdjango\b/i },
  { name: 'FastAPI', slug: 'fastapi', re: /\bfastapi\b/i },
  { name: 'Flask', re: /\bflask\b/i },
  { name: 'Rails', slug: 'rails', re: /\brails\b|\bruby on rails\b/i },
  { name: 'Spring', re: /\bspring\b/i },

  // Data / infra
  { name: 'PostgreSQL', slug: 'postgresql', re: /\bpostgres(ql)?\b/i },
  { name: 'MySQL', slug: 'mysql', re: /\bmysql\b/i },
  { name: 'MongoDB', slug: 'mongodb', re: /\bmongo(db)?\b/i },
  { name: 'Redis', re: /\bredis\b/i },
  { name: 'Elasticsearch', slug: 'elasticsearch', re: /\belastic(search)?\b/i },
  { name: 'Kafka', re: /\bkafka\b/i },

  // Cloud / devops
  { name: 'AWS', slug: 'aws', re: /\baws\b|\bamazon web services\b/i },
  { name: 'GCP', slug: 'gcp', re: /\bgcp\b|\bgoogle cloud\b/i },
  { name: 'Azure', re: /\bazure\b/i },
  { name: 'Docker', re: /\bdocker\b/i },
  { name: 'Kubernetes', slug: 'kubernetes', re: /\bkubernetes\b|\bk8s\b/i },
  { name: 'Terraform', re: /\bterraform\b/i },

  // ML / AI
  { name: 'PyTorch', slug: 'pytorch', re: /\bpytorch\b/i },
  { name: 'TensorFlow', slug: 'tensorflow', re: /\btensorflow\b/i },
  { name: 'scikit-learn', slug: 'scikit-learn', re: /\bscikit[\s-]?learn\b/i },

  // APIs
  { name: 'GraphQL', slug: 'graphql', re: /\bgraphql\b/i },

  // Data tooling
  { name: 'dbt', slug: 'dbt', re: /\bdbt\b/i },
  { name: 'Airflow', slug: 'airflow', re: /\bairflow\b/i },

  // Dev workflow
  { name: 'GitHub', slug: 'github', re: /\bgithub\b/i },
]

function normalizeSlug(name: string, explicitSlug?: string): string {
  if (explicitSlug) return explicitSlug
  return slugify(name, { lower: true, strict: true, trim: true })
}

function decodeHtmlEntitiesOnce(input: string): string {
  return String(input || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n) => {
      const code = Number.parseInt(String(n), 10)
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
      try {
        return String.fromCodePoint(code)
      } catch {
        return ''
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = Number.parseInt(String(hex), 16)
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
      try {
        return String.fromCodePoint(code)
      } catch {
        return ''
      }
    })
}

function decodeHtmlEntities(input: string): string {
  let out = String(input || '')
  for (let i = 0; i < 2; i++) {
    const next = decodeHtmlEntitiesOnce(out)
    if (next === out) break
    out = next
  }
  return out
}

function normalizeToPlainText(input: string): string {
  const decoded = decodeHtmlEntities(input)
  return decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export type TechStackFromText = {
  display: string[]
  slugs: string[]
}

export function extractTechStackFromText(text: string): TechStackFromText {
  const t = normalizeToPlainText(text)
  if (!t) return { display: [], slugs: [] }

  const found: Array<{ name: string; slug: string }> = []
  const seen = new Set<string>()

  for (const p of TECH_PATTERNS) {
    if (!p.re.test(t)) continue
    const slug = normalizeSlug(p.name, p.slug)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    found.push({ name: p.name, slug })
  }

  return {
    display: found.map((x) => x.name),
    slugs: found.map((x) => x.slug),
  }
}

export type TechStackResult = {
  displayNames: string[]
  slugs: string[]
}

export function extractTechStack(description: string | null): TechStackResult {
  const out = extractTechStackFromText(description || '')
  return { displayNames: out.display, slugs: out.slugs }
}

