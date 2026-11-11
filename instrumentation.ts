// instrumentation.ts
// Runs once when the server starts. In production, warms the busiest pages a few seconds after start, then keeps
// every hub page in the sitemaps warm with a slow pass every 45 minutes (lib/runtime/warmPages.ts).
// WARM_ON_START=0 turns both off.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production' || process.env.WARM_ON_START === '0') return

  const { REWARM_EVERY_MS, REWARM_GAP_MS, WARM_PATHS, hubPaths, warmPages } = await import('./lib/runtime/warmPages')
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`

  const run = async (label: string, paths: readonly string[], gapMs: number) => {
    const started = Date.now()
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
