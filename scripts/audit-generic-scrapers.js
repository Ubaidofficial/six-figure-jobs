const fs = require('fs')
const path = require('path')

// Read generic scraper config
const genericPath = path.join(__dirname, '..', 'lib', 'scrapers', 'generic.ts')
const content = fs.readFileSync(genericPath, 'utf8')

// Extract source URLs
const sources = content.match(/url: ['"]([^'"]+)['"]/g) || []
console.log('Generic sources configured:', sources.length)
console.log('\nSources:')
sources.forEach((s, i) => {
  const url = s.match(/url: ['"]([^'"]+)['"]/)?.[1]
  console.log(`${i + 1}. ${url}`)
})
