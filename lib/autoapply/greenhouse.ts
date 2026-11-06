// Greenhouse: which job an apply link is, and what the employer's form asks. Uses Greenhouse's public, read-only
// Job Board API (no key, no login): the same data the employer's own application page is built from.

export type GreenhouseJobRef = { board: string; jobId: string }

const HOSTS = new Set(['boards.greenhouse.io', 'job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io'])

/** `https://job-boards.greenhouse.io/<board>/jobs/<id>` (also the older boards. host) to its board and job; null for anything else. */
export function parseGreenhouseUrl(url: string | null | undefined): GreenhouseJobRef | null {
  try {
    const u = new URL(String(url))
    if (u.protocol !== 'https:' || !HOSTS.has(u.hostname)) return null
    const m = /^\/([A-Za-z0-9_-]+)\/jobs\/(\d+)\/?$/.exec(u.pathname)
    return m ? { board: m[1], jobId: m[2] } : null
  } catch {
    return null
  }
}

export type GhValue = { label: string; value: string | number }
export type GhField = { name: string; type: string; values?: GhValue[] }
export type GhQuestion = { label: string; required: boolean; description?: string; fields: GhField[] }
export type GhJob = {
  title: string
  questions: GhQuestion[]
  /** Questions in the equal-opportunity (EEOC) block; always optional and never answered by us. */
  eeoc: GhQuestion[]
  /** True when the board asks for consent (data processing or retention) before applying. */
  needsConsent: boolean
}

const API = 'https://boards-api.greenhouse.io/v1/boards'

export async function fetchGreenhouseJob(
  ref: GreenhouseJobRef,
  fetchImpl: typeof fetch = fetch,
): Promise<GhJob | null> {
  const res = await fetchImpl(`${API}/${ref.board}/jobs/${ref.jobId}?questions=true`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    title?: string
    questions?: GhQuestion[]
    compliance?: Array<{ type?: string; questions?: GhQuestion[] }>
    data_compliance?: Array<{ requires_consent?: boolean; requires_processing_consent?: boolean; requires_retention_consent?: boolean }>
  }
  if (!data || typeof data.title !== 'string' || !Array.isArray(data.questions)) return null
  return {
    title: data.title,
    questions: data.questions,
    eeoc: (data.compliance ?? []).filter((c) => c.type === 'eeoc').flatMap((c) => c.questions ?? []),
    needsConsent: (data.data_compliance ?? []).some(
      (d) => d.requires_consent || d.requires_processing_consent || d.requires_retention_consent,
    ),
  }
}
