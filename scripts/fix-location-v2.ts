import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function parseLocationProperly(locationRaw: string): {
  primaryLocation: string
  city: string | null
  countryCode: string | null
  cleanLocations: Array<{ city: string | null; state: string | null; country: string | null }>
} {
  // Handle "Remote-Friendly (Travel-Required) | Location" format
  let cleaned = locationRaw
  
  // If starts with Remote-Friendly/Hybrid/Remote prefix, extract actual location after |
  if (/^(Remote-Friendly|Hybrid|Remote)\s*\([^)]+\)\s*\|/i.test(cleaned)) {
    const parts = cleaned.split('|').map(p => p.trim())
    cleaned = parts.slice(1).join(', ') // Take everything after first |
  } else {
    // Just remove simple prefixes
    cleaned = cleaned.replace(/^(Remote|Hybrid)\s*[-]\s*/gi, '').trim()
  }

  // Split by delimiters
  const locations = cleaned.split(/[;|]/).map(loc => loc.trim()).filter(Boolean)
  const primary = locations[0] || cleaned

  // Parse first location for city/country
  const firstLoc = primary.split(',').map(p => p.trim()).filter(Boolean)
  
  let city: string | null = null
  let countryCode: string | null = null
  
  if (firstLoc.length >= 2) {
    city = firstLoc[0]
    
    // Check for US state codes or "United States"
    const hasUSState = firstLoc.some(p => /^(NY|CA|TX|FL|WA|IL|PA|OH|GA|NC|MI|NJ|VA|MA|IN|TN|MO|MD|WI|MN|CO|AL|SC|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY)$/.test(p))
    const hasUSText = firstLoc.some(p => /USA|United States/i.test(p))
    
    if (hasUSState || hasUSText) {
      countryCode = 'US'
    } else if (firstLoc.some(p => /UK|United Kingdom|England|Scotland|Wales/i.test(p))) {
      countryCode = 'GB'
    } else if (firstLoc.some(p => /Canada/i.test(p))) {
      countryCode = 'CA'
    } else if (firstLoc.some(p => /Germany|Deutschland/i.test(p))) {
      countryCode = 'DE'
    } else if (firstLoc.some(p => /France/i.test(p))) {
      countryCode = 'FR'
    }
  }
  
  const cleanLocations = locations.map(loc => {
    const parts = loc.split(',').map(p => p.trim())
    return {
      city: parts[0] || null,
      state: parts[1] || null,
      country: parts[2] || null
    }
  })

  return {
    primaryLocation: primary,
    city,
    countryCode,
    cleanLocations
  }
}

async function main() {
  console.log('🔧 Fixing location data (v2)...\n')
  
  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      locationRaw: { not: null }
    },
    select: {
      id: true,
      locationRaw: true
    }
  })

  console.log(`Found ${jobs.length} jobs\n`)

  let fixed = 0
  for (const job of jobs) {
    const { primaryLocation, city, countryCode, cleanLocations } = parseLocationProperly(job.locationRaw!)
    
    await prisma.job.update({
      where: { id: job.id },
      data: {
        primaryLocation,
        city,
        countryCode,
        locationsJson: cleanLocations
      }
    })
    
    fixed++
    if (fixed % 100 === 0) {
      console.log(`✅ Fixed ${fixed}/${jobs.length}...`)
    }
  }

  console.log(`\n✅ Complete! Fixed ${fixed} jobs`)

  // Show problematic samples
  const samples = await prisma.job.findMany({
    where: { 
      isExpired: false,
      locationRaw: { contains: 'Remote-Friendly' }
    },
    select: {
      title: true,
      locationRaw: true,
      primaryLocation: true,
      city: true,
      countryCode: true
    },
    take: 3
  })

  console.log('\n📋 Remote-Friendly samples:')
  samples.forEach(s => {
    console.log(`\n${s.title}`)
    console.log(`  Raw: ${s.locationRaw}`)
    console.log(`  Primary: ${s.primaryLocation}`)
    console.log(`  City: ${s.city}`)
    console.log(`  Country: ${s.countryCode}`)
  })

  await prisma.$disconnect()
}

main()
