// lib/jobs/mojibake.ts
//
// Repairs text whose UTF-8 bytes were read as Windows-1252 somewhere upstream: "Engineer â€” Remote" for "Engineer — Remote",
// "cafÃ©" for "café". RemoteOK is one source that sends this. Only a run that decodes back to valid UTF-8 is changed, so
// ordinary text (including real accented letters) is left alone. Pure.

// Windows-1252 bytes 0x80-0x9F and the characters they show as; the other bytes read as the same Latin-1 character.
const CP1252_BYTE_BY_CHAR = new Map<string, number>(
  Object.entries({
    0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030,
    0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022,
    0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
  }).map(([byte, code]) => [String.fromCharCode(code), Number(byte)] as const),
)

const CONTINUATION = `[\\u0080-\\u00BF${[...CP1252_BYTE_BY_CHAR.keys()].join('')}]`
// A UTF-8 lead byte (as Latin-1: U+00C2-U+00F4) followed by 1-3 continuation bytes, repeated.
const RUN = new RegExp(`(?:[\\u00C2-\\u00F4]${CONTINUATION}{1,3})+`, 'g')

function repair(run: string): string {
  const bytes: number[] = []
  for (const ch of run) {
    const code = ch.codePointAt(0)!
    const byte = CP1252_BYTE_BY_CHAR.get(ch) ?? (code <= 0xff ? code : -1)
    if (byte < 0) return run
    bytes.push(byte)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes))
  } catch {
    return run
  }
}

export function fixMojibake(text: string | null | undefined): string {
  const input = String(text ?? '')
  // Fast path: nearly all text has no lead-byte character followed by a continuation character.
  return /[Â-ô]/.test(input) ? input.replace(RUN, repair) : input
}
