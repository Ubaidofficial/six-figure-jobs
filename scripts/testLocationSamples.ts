// scripts/testLocationSamples.ts

import { format as __format } from 'node:util'
import { normalizeLocation } from '../lib/normalizers/location'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


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
  __slog('\nRAW :', raw)
  __slog('NORM:', normalizeLocation(raw))
}
