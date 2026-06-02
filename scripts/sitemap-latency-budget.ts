const SITEMAP_URL = process.env.SEO_BASE_URL
  ? `${process.env.SEO_BASE_URL}/sitemap.xml`
  : 'http://localhost:3000/sitemap.xml'

async function run() {
  const args = process.argv.slice(2)
  let threshold = 1500

  for (const arg of args) {
    if (arg.startsWith('--threshold=')) {
      threshold = parseInt(arg.split('=')[1], 10)
    }
  }

  console.log(`Checking latency for ${SITEMAP_URL}`)
  console.log(`Latency budget: ${threshold}ms`)

  const start = Date.now()
  try {
    const res = await fetch(SITEMAP_URL, {
      // Add a cache buster to bypass edge caching if we are testing the origin
      // Wait, Next.js unstable_cache will still hit the cache, which is what we want to test!
    })
    
    // We must consume the response
    await res.text()
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
  } catch (err: any) {
    console.error(`❌ Request failed: ${err.message}`)
    process.exit(1)
  }

  const elapsed = Date.now() - start
  console.log(`Response time: ${elapsed}ms`)

  if (elapsed > threshold) {
    console.error(`\n❌ ERROR: Sitemap latency (${elapsed}ms) exceeds budget of ${threshold}ms!`)
    process.exit(1)
  }

  console.log(`\n✅ PASS: Sitemap rendered within budget.`)
  process.exit(0)
}

run()
