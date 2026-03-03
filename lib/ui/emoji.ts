// lib/ui/emoji.ts

export const EMOJI = {
  salary: '💰',
  remote: '🌍',
  location: '📍',
  verified: '✅',
  featured: '⭐',
  new: '🆕',
  posted: '⏱️',
  apply: '↗️',
  highlights: '✨',
  requirements: '📌',
  benefits: '🎁',
  company: '🏢',
  quality: '🛡️',
  type: '🧑‍💼',
  level: '🎯',
  similar: '🔎',
} as const

export type EmojiKey = keyof typeof EMOJI

export function e(key: EmojiKey): string {
  return EMOJI[key]
}
