// lib/seo/keywordMap.ts
//
// Primary and secondary keyword for each kind of page: the one phrase the <title> and H1 are written around, and the
// related searches the description and body cover. `[role]`, `[place]` etc. stand for the page's own value.
//
// Source: OpenSEO / DataForSEO US monthly searches, recorded in OpenSEO's research log (2026-11-05) and CHANGELOG
// (2026-11-09, 2026-11-11). These are tool estimates that change; re-check before leaning on one number. Known volumes:
//   high paying jobs / highest paying jobs ~201k · remote software engineer jobs 49.5k · software engineer jobs 40.5k
//   data scientist jobs 33.1k · high paying jobs without a degree 22.2k · data engineer jobs 12.1k
//   machine learning engineer jobs 9.9k · product manager jobs 9.9k · jobs that pay 100k a year 8.1k
//   high paying remote jobs 8.1k · six figure jobs / 6 figure jobs 5.4k (counted as one search) · frontend dev jobs 3.6k
//   devops jobs 3.6k · senior software engineer salary 3.6k · software engineer jobs new york 2.9k
//   python developer jobs 2.4k · six figure jobs without a degree ~1.6k · senior software engineer jobs 1.3k
//   kubernetes jobs 880
// OpenSEO, 2026-11-14: jobs paying 100k 1.3k · 100k jobs 1.0k · 100k a year jobs 880 · high paying jobs 2026 590 ·
//   remote jobs 100k 590 · software engineer salary 2026 ~20. "$100k jobs 8,100" in docs/SEO_SPEC.md (Dec 2025) did
//   not reproduce: the tool returned no row for it, and "100k jobs" is 1.0k.
//
// `titleHas` is what the title must contain (hyphens read as spaces, case ignored); __tests__/seo/keywordMap.test.ts
// checks it against the real title builders so a template change cannot quietly drop the primary keyword.

export type PageKeywords = {
  /** The phrase the title and H1 are built around. */
  primary: string
  /** Related searches for the description and body. */
  secondary: string[]
  /** Lowercase fragment every title of this page type must contain. */
  titleHas: string
}

export const KEYWORD_MAP = {
  home: {
    primary: 'six figure jobs',
    secondary: ['6 figure jobs', 'high paying jobs', '$100k jobs', 'high paying remote jobs'],
    titleHas: 'six figure jobs',
  },
  // Not "six figure jobs": that is the home page's keyword, and two pages on one phrase compete with each other.
  jobsHub: {
    primary: 'jobs paying $100k+',
    secondary: ['100k jobs', '100k a year jobs', 'six figure jobs', 'high paying jobs'],
    titleHas: 'jobs paying $100k+',
  },
  highPayingJobs: {
    primary: 'high paying jobs',
    secondary: ['highest paying jobs', 'high paying jobs without a degree'],
    titleHas: 'high paying jobs',
  },
  noDegree: {
    primary: 'high paying jobs without a degree',
    secondary: ['six figure jobs without a degree', 'no degree jobs $100k'],
    titleHas: 'without a degree',
  },
  remoteHub: {
    primary: 'high paying remote jobs',
    secondary: ['remote jobs $100k', 'six figure remote jobs', 'work from home $100k jobs'],
    titleHas: 'remote jobs',
  },
  remoteRole: {
    primary: 'remote [role] jobs',
    secondary: ['high paying remote [role] jobs', '[role] jobs $100k', '[role] work from home'],
    titleHas: 'remote',
  },
  role: {
    primary: '[role] jobs',
    secondary: ['high paying [role] jobs', '$100k [role] jobs', '[role] salary'],
    titleHas: 'jobs',
  },
  salaryGuide: {
    primary: '[role] salary',
    secondary: ['average [role] salary', '[role] salary range', '[role] pay'],
    titleHas: 'salary',
  },
  salaryTier: {
    primary: 'jobs that pay [amount] a year',
    secondary: ['$100k jobs', '100k jobs', 'six figure jobs'],
    titleHas: 'jobs that pay',
  },
  country: {
    primary: 'high paying jobs in [country]',
    secondary: ['$100k jobs in [country]', 'six figure jobs in [country]', 'remote jobs in [country]'],
    titleHas: 'high paying jobs in',
  },
  city: {
    primary: 'high paying jobs in [city]',
    secondary: ['$100k jobs in [city]', '[role] jobs in [city]', 'six figure jobs in [city]'],
    titleHas: 'high paying jobs in',
  },
  state: {
    primary: 'high paying jobs in [state]',
    secondary: ['$100k jobs in [state]', 'six figure jobs in [state]'],
    titleHas: 'high paying jobs in',
  },
  skill: {
    primary: '[skill] jobs',
    secondary: ['$100k [skill] jobs', '[skill] developer jobs', 'high paying [skill] jobs'],
    titleHas: 'jobs',
  },
  level: {
    primary: '[level] jobs',
    secondary: ['$100k [level] jobs', 'high paying [level] jobs'],
    titleHas: 'jobs',
  },
  category: {
    primary: '[category] jobs',
    secondary: ['$100k [category] jobs', 'high paying [category] jobs'],
    titleHas: 'jobs',
  },
  companies: {
    primary: 'companies hiring $100k+ jobs',
    secondary: ['high paying companies', 'six figure jobs companies', 'top companies hiring'],
    titleHas: 'companies hiring',
  },
  remoteCompanies: {
    primary: 'remote companies hiring $100k+ roles',
    secondary: ['remote companies', 'high paying remote jobs', 'work from home companies'],
    titleHas: 'remote companies',
  },
  fourDayWeek: {
    primary: '4 day work week jobs',
    secondary: ['4 day work week jobs $100k', '32 hour work week jobs', 'four day week remote jobs'],
    titleHas: '4 day work week jobs',
  },
  company: {
    primary: '[company] jobs',
    secondary: ['[company] careers', '[company] salary', '[company] $100k jobs'],
    titleHas: 'jobs',
  },
} as const satisfies Record<string, PageKeywords>

export type KeywordPageType = keyof typeof KEYWORD_MAP

/**
 * The page type's keywords for `<meta name="keywords">`, lowercase, with the page's own values filled in
 * (`{ role: 'Software Engineer' }` turns "[role] jobs" into "software engineer jobs"); a keyword whose value is not
 * given is left out. Google does not use this tag; it is here for engines and tools that still read it.
 */
export function keywordsFor(type: KeywordPageType, values: Record<string, string> = {}): string[] {
  const { primary, secondary } = KEYWORD_MAP[type]
  const filled = [primary, ...secondary].map((k) =>
    k.replace(/\[(\w+)\]/g, (whole, key: string) => (values[key] ? values[key].toLowerCase() : whole)).toLowerCase(),
  )
  return [...new Set(filled.filter((k) => !k.includes('[')))]
}
