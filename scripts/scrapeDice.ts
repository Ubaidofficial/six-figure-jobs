import scrapeDice from '../lib/scrapers/dice'

async function main() {
  const stats = await scrapeDice()
  console.log('[Dice] Done:', stats)

  if (stats.error) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

