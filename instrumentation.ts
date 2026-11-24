// instrumentation.ts
// Runs once when the server starts. In production:
//  - warms the busiest pages a few seconds after start, then keeps every hub page in the sitemaps warm with a slow pass
//    every 45 minutes (lib/runtime/warmPages.ts); WARM_ON_START=0 turns both off;
//  - logs a `[stall]` line when the event loop was blocked for 500 ms or more (lib/runtime/stallWatch.ts); STALL_LOG_MS
//    sets the milliseconds, STALL_WATCH=0 turns it off;
//  - saves freehire's newest jobs every 5 minutes (lib/scrapers/freehireRecent.ts), first 5 minutes after start;
//    FREEHIRE_RECENT_EVERY_MIN sets the minutes, 0 turns it off;
//  - checks the data pipeline's health every 30 minutes and emails the owner when a check turns bad or recovers
//    (lib/admin/healthAlerts.ts), first 10 minutes after start; HEALTH_ALERTS_EVERY_MIN sets the minutes, 0 turns it off.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return

  if (process.env.STALL_WATCH !== '0') {
    const { startStallWatch } = await import('./lib/runtime/stallWatch')
    startStallWatch({ thresholdMs: Number(process.env.STALL_LOG_MS) || undefined })
  }

  const { FREEHIRE_RECENT_START_DELAY_MS, freehireRecentEveryMs, runFreehireRecent } = await import('./lib/scrapers/freehireRecent')
  const everyMs = freehireRecentEveryMs()
  if (everyMs) {
    const tick = () => {
      console.log('[freehire-recent] begin')
      runFreehireRecent().catch((e) => console.error('[freehire-recent] run failed:', e instanceof Error ? e.message.split('\n')[0] : e))
    }
    setTimeout(() => {
      tick()
      setInterval(tick, everyMs).unref()
    }, FREEHIRE_RECENT_START_DELAY_MS).unref()
  }

  const { START_DELAY_MS, healthAlertsEveryMs, runHealthAlerts } = await import('./lib/admin/healthAlerts')
  const healthEveryMs = healthAlertsEveryMs()
  if (healthEveryMs) {
    const check = () =>
      runHealthAlerts().catch((e) => console.error('[health-alerts] run failed:', e instanceof Error ? e.message.split('\n')[0] : e))
    setTimeout(() => {
      void check()
      setInterval(check, healthEveryMs).unref()
    }, START_DELAY_MS).unref()
  }

  if (process.env.WARM_ON_START === '0') return

  const { HUBS_WARM_DELAY_MS, REWARM_EVERY_MS, REWARM_GAP_MS, WARM_PATHS, hubPaths, warmPages } = await import('./lib/runtime/warmPages')
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`

  const run = async (label: string, paths: readonly string[], gapMs: number) => {
    const started = Date.now()
    console.log(`[warm:${label}] begin ${paths.length} pages`)
    const results = await warmPages(base, paths, fetch, undefined, gapMs)
    const ok = results.filter((r) => r.status === 200).length
    const slow = results.filter((r) => r.ms > 3000).map((r) => `${r.path} ${r.status ?? 'failed'} ${r.ms}ms`)
    console.log(`[warm:${label}] ${ok}/${results.length} pages in ${Math.round((Date.now() - started) / 1000)}s${slow.length ? `; slow: ${slow.join(', ')}` : ''}`)
  }

  // Hub pages not in WARM_PATHS, read from the sitemaps each pass so the list follows them.
  const hubs = async () => (await hubPaths(base)).filter((p) => !(WARM_PATHS as readonly string[]).includes(p))

  setTimeout(() => {
    void (async () => {
      await run('start', WARM_PATHS, 0)
      await new Promise((r) => setTimeout(r, HUBS_WARM_DELAY_MS)) // the long pass waits, see HUBS_WARM_DELAY_MS
      await run('hubs', await hubs(), REWARM_GAP_MS)
      let running = false // a slow pass never overlaps the next one
      setInterval(() => {
        if (running) return
        running = true
        void (async () => run('rewarm', [...WARM_PATHS, ...(await hubs())], REWARM_GAP_MS))()
          .catch(() => undefined)
          .finally(() => {
            running = false
          })
      }, REWARM_EVERY_MS).unref()
    })().catch(() => undefined)
  }, 3000)
}
