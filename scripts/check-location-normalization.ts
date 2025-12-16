import { normalizeLocationRaw, hasMultiLocationSignals } from '../lib/location/locationRaw'

const samples = [
  'San Francisco, California, United States',
  'San Francisco, CA • New York, NY • United States',
  'Remote, Canada; Remote, US',
  'A, B, C, D',
  '🇺🇸 USA',
  '🌍 Anywhere',
  '🇺🇸 USA, 🇨🇦 Canada',
]

for (const raw of samples) {
  const lr = normalizeLocationRaw(raw)
  console.log({
    raw,
    normalized: lr,
    multi: hasMultiLocationSignals(lr),
  })
}
