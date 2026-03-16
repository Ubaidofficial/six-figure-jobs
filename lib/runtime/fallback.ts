export function logRuntimeFallback(scope: string, error: unknown) {
  console.error(`[${scope}] fallback_used=1 reason=runtime_error`, error)
}
