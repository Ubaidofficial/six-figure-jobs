import scrapeWellfound from '../lib/scrapers/wellfound'

async function main() {
  const stats = await scrapeWellfound()
  console.log('[Wellfound] Done:', stats)

  if (stats.error) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

