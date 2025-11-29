// lib/ingest/sourcePriority.ts
// Source priority constants for job deduplication
// Higher number = more authoritative source
//
// When the same job appears from multiple sources, we prefer:
// 1. ATS feeds (direct from company) - priority 100
// 2. Direct careers pages (future) - priority 90
// 3. High-quality curated boards - priority 50
// 4. Standard job boards - priority 40
// 5. Lower-quality boards - priority 30
// 6. Unknown sources - priority 20

// =============================================================================
// Source Type Constants (use these instead of hardcoding strings)
// =============================================================================

export const ATS_SOURCES = {
  GREENHOUSE: 'ats:greenhouse',
  LEVER: 'ats:lever',
  ASHBY: 'ats:ashby',
  WORKDAY: 'ats:workday',
} as const

export const BOARD_SOURCES = {
  REMOTE100K: 'board:remote100k',
  REMOTEROCKETSHIP: 'board:remoterocketship',
  REMOTEOK: 'board:remoteok',
  REMOTIVE: 'board:remotive',
  REMOTEAI: 'board:remoteai',
  WEWORKREMOTELY: 'board:weworkremotely',
  BUILTIN: 'board:builtin',
} as const

export const OTHER_SOURCES = {
  COMPANY_CAREERS: 'company:careers',
  OTHER: 'other',
} as const

// =============================================================================
// Priority Map
// =============================================================================

export const SOURCE_PRIORITY: Record<string, number> = {
  // ATS sources (highest priority - canonical, direct from company)
  [ATS_SOURCES.GREENHOUSE]: 100,
  [ATS_SOURCES.LEVER]: 100,
  [ATS_SOURCES.ASHBY]: 100,
  [ATS_SOURCES.WORKDAY]: 100,

  // Direct careers pages (future enhancement)
  [OTHER_SOURCES.COMPANY_CAREERS]: 90,

  // High-quality curated boards (100k+ focused)
  [BOARD_SOURCES.REMOTE100K]: 50,
  [BOARD_SOURCES.REMOTEROCKETSHIP]: 50,

  // Standard job boards
  [BOARD_SOURCES.REMOTEOK]: 40,
  [BOARD_SOURCES.REMOTIVE]: 40,
  [BOARD_SOURCES.REMOTEAI]: 40,

  // Lower-quality / less reliable boards
  [BOARD_SOURCES.WEWORKREMOTELY]: 30,
  [BOARD_SOURCES.BUILTIN]: 30,

  // Fallback for unknown sources
  [OTHER_SOURCES.OTHER]: 20,
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the priority for a given source string.
 * Falls back to 20 (lowest) if source is not recognized.
 */
export function getSourcePriority(source: string): number {
  // Direct lookup
  if (SOURCE_PRIORITY[source] !== undefined) {
    return SOURCE_PRIORITY[source]
  }

  // Pattern matching fallback for ATS sources we might not have listed
  if (source.startsWith('ats:')) {
    return 100 // All ATS sources are high priority
  }

  if (source.startsWith('company:')) {
    return 90 // All direct company sources are high priority
  }

  if (source.startsWith('board:')) {
    return 30 // Unknown boards get lower priority
  }

  return SOURCE_PRIORITY[OTHER_SOURCES.OTHER]
}

/**
 * Check if a source is from an ATS (Applicant Tracking System)
 */
export function isAtsSource(source: string): boolean {
  return source.startsWith('ats:')
}

/**
 * Check if a source is from a job board
 */
export function isBoardSource(source: string): boolean {
  return source.startsWith('board:')
}

/**
 * Check if a source is from direct company careers page
 */
export function isCompanySource(source: string): boolean {
  return source.startsWith('company:')
}

/**
 * Compare two sources and return which one should take precedence.
 * Returns: 
 *   positive number if sourceA wins
 *   negative number if sourceB wins  
 *   0 if they are equal priority
 */
export function compareSourcePriority(sourceA: string, sourceB: string): number {
  return getSourcePriority(sourceA) - getSourcePriority(sourceB)
}

/**
 * Build a source string for a board scraper.
 * @param boardName - e.g. "remoteok", "remote100k"
 */
export function makeBoardSource(boardName: string): string {
  return `board:${boardName.toLowerCase()}`
}

/**
 * Build a source string for an ATS scraper.
 * @param provider - e.g. "greenhouse", "lever"
 */
export function makeAtsSource(provider: string): string {
  return `ats:${provider.toLowerCase()}`
}