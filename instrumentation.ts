// instrumentation.ts
// Runs once when the server starts. In production, warms the busiest pages a few seconds after start
// (lib/runtime/warmPages.ts). WARM_ON_START=0 turns it off.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production' || process.env.WARM_ON_START === '0') return

  const { warmPages } = await import('./lib/runtime/warmPages')
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`
  setTimeout(() => {
    const started = Date.now()
    void warmPages(base).then((results) => {
      const ok = results.filter((r) => r.status === 200).length
      console.log(`[warm] ${ok}/${results.length} pages warmed in ${Math.round((Date.now() - started) / 1000)}s`, results.map((r) => `${r.path} ${r.status ?? 'failed'} ${r.ms}ms`).join(', '))
    })
  }, 3000)
}
