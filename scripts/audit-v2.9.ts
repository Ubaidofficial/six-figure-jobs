import { access } from 'node:fs/promises'

const REQUIRED_PATHS = [
  'scripts/seo-validate.ts',
  'scripts/seo-template-sanity.ts',
  'lib/seo/indexabilityGates.ts',
  'app/sitemap.xml/route.ts',
]

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  const missing: string[] = []
  for (const path of REQUIRED_PATHS) {
    const ok = await exists(path)
    if (!ok) {
      missing.push(path)
    }
  }

  if (missing.length > 0) {
    console.error('[audit:v2.9] missing required files:')
    for (const path of missing) {
      console.error(`- ${path}`)
    }
    process.exitCode = 1
    return
  }

  console.log('[audit:v2.9] required SEO audit files present')
  console.log(`[audit:v2.9] checked ${REQUIRED_PATHS.length} paths`)
}

main().catch((error) => {
  console.error('[audit:v2.9] fatal error:', error)
  process.exit(1)
})
