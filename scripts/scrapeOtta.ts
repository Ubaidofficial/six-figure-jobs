import scrapeOtta from '../lib/scrapers/otta'

async function main() {
  const stats = await scrapeOtta()
  console.log('[Otta] Done:', stats)

  if (stats.error) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

