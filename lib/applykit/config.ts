// Application kit settings. The price is a product decision, so it comes from env; the default is a placeholder.

/** PLACEHOLDER: credits one kit costs when APPLICATION_KIT_CREDITS is unset. The owner sets the real number. */
export const PLACEHOLDER_KIT_CREDITS = 1

export function getKitCredits(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.APPLICATION_KIT_CREDITS)
  return Number.isInteger(n) && n > 0 && n <= 1000 ? n : PLACEHOLDER_KIT_CREDITS
}

export const RESUME_MIN_CHARS = 200
export const RESUME_MAX_CHARS = 20_000
/** Longest job description sent to the model; the rest is cut (the role and requirements come first). */
export const JOB_TEXT_MAX_CHARS = 12_000
export const NOTES_MAX_CHARS = 2_000

export const KIT_STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'] as const
export type KitStatus = (typeof KIT_STATUSES)[number]
export const isKitStatus = (v: unknown): v is KitStatus => (KIT_STATUSES as readonly string[]).includes(v as string)
