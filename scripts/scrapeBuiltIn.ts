import scrapeBuiltIn from '../lib/scrapers/builtin'

async function main() {
  const stats = await scrapeBuiltIn()
  console.log('[BuiltIn] Done:', stats)

  if (stats.error) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

