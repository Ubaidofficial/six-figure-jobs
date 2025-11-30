// scripts/testLocationSamples.ts

import { normalizeLocation } from '../lib/normalizers/location'

const samples = [
  'Remote',
  'Remote - US',
  'Remote - UK',
  'Remote | Canada',
  'San Francisco, CA, US',
  'Berlin, Germany (Hybrid)',
  'London or Remote (EMEA)',
  'Remote – Germany',
  'Hybrid - Dublin, Ireland',
  'Sydney, Australia (Remote possible)',
]

for (const raw of samples) {
  console.log('\nRAW :', raw)
  console.log('NORM:', normalizeLocation(raw))
}
