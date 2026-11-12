// Picks what a scheduled freehire-sync run does: 'full', 'light' or 'skip' (.github/workflows/freehire-sync.yml).
//
// GitHub starts this workflow's scheduled runs hours late and sometimes not at all (2026-11-12: the 05:17 run started
// at 13:43; the 11:17 and 17:17 light runs never started). So the workflow is scheduled every hour and this script
// decides from the previous runs' start times: a full run when none started in the last 20 hours, a light run when no
// sync started in the last 5.5 hours, otherwise nothing. Failed and timed-out runs count, so a failing run is not
// retried every hour against freehire's daily quota. Plain Node, no dependencies: the hourly check needs no npm ci.

const HOUR_MS = 60 * 60 * 1000
const FULL_EVERY_MS = 20 * HOUR_MS
const LIGHT_EVERY_MS = 5.5 * HOUR_MS

/**
 * @param {{ name: string, startedAt: string | null, conclusion: string | null }[]} syncJobs earlier runs' sync jobs
 * @param {number} now
 * @returns {'full' | 'light' | 'skip'}
 */
function decideFreehireMode(syncJobs, now) {
  const started = syncJobs.filter((job) => job.startedAt && job.conclusion !== 'skipped')
  const startedWithin = (ms, predicate) => started.some((job) => predicate(job) && now - Date.parse(job.startedAt) < ms)
  // Runs before 2026-11-13 named the job "sync"; none of them was a light run.
  const isFull = (job) => job.name === 'sync (full)' || job.name === 'sync'

  if (!startedWithin(FULL_EVERY_MS, isFull)) return 'full'
  if (!startedWithin(LIGHT_EVERY_MS, () => true)) return 'light'
  return 'skip'
}

/** The fixed times this workflow used before, for when the GitHub API cannot be read. */
function fallbackMode(now) {
  const hour = new Date(now).getUTCHours()
  if (hour === 5) return 'full'
  return [11, 17, 23].includes(hour) ? 'light' : 'skip'
}

async function main() {
  const { GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_TOKEN, GITHUB_OUTPUT } = process.env
  const now = Date.now()
  const api = async (path) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/${path}`, {
      headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`)
    return res.json()
  }

  let mode
  try {
    // Created up to 30 hours ago: a run can start many hours after it was created.
    const since = new Date(now - 30 * HOUR_MS).toISOString()
    const { workflow_runs: runs } = await api(
      `actions/workflows/freehire-sync.yml/runs?per_page=100&created=${encodeURIComponent(`>=${since}`)}`
    )
    const syncJobs = []
    for (const run of runs) {
      if (String(run.id) === GITHUB_RUN_ID) continue
      const { jobs } = await api(`actions/runs/${run.id}/jobs`)
      for (const job of jobs) {
        if (job.name.startsWith('sync')) {
          syncJobs.push({ name: job.name, startedAt: job.started_at, conclusion: job.conclusion })
        }
      }
    }
    mode = decideFreehireMode(syncJobs, now)
    const last = syncJobs.filter((job) => job.startedAt && job.conclusion !== 'skipped').map((j) => `${j.name} ${j.startedAt}`)
    console.log(`Recent syncs: ${last.length ? last.join(', ') : 'none'}`)
  } catch (error) {
    mode = fallbackMode(now)
    console.log(`::warning::Could not read earlier runs (${error.message}); using the fixed schedule: ${mode}`)
  }

  console.log(`mode=${mode}`)
  if (GITHUB_OUTPUT) require('node:fs').appendFileSync(GITHUB_OUTPUT, `mode=${mode}\n`)
}

if (require.main === module) {
  main()
}

module.exports = { decideFreehireMode, fallbackMode }
