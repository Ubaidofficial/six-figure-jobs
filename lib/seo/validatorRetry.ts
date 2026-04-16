export type ValidationFailureLike = {
  reason: string
  detail?: string
}

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524])

function hasCanonicalTag(html: string): boolean {
  return /<link[^>]*rel=["']canonical["'][^>]*>/i.test(html)
}

function hasTitleTag(html: string): boolean {
  return /<title[\s>]/i.test(html)
}

function hasStreamingShellMarkers(html: string): boolean {
  return /JobsLoading_|aria-busy=["']true["']|<template id="B:/i.test(html)
}

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUSES.has(status)
}

export function isLikelyIncompleteHtml(html: string): boolean {
  const normalized = String(html || '')
  if (!normalized) return true
  if (!/<\/html>/i.test(normalized)) return true
  if (!hasCanonicalTag(normalized) && !hasTitleTag(normalized)) return true
  return hasStreamingShellMarkers(normalized) && !hasCanonicalTag(normalized)
}

export function buildCanonicalMissingDetail(html: string): string {
  const normalized = String(html || '')
  const hints: string[] = []

  if (isLikelyIncompleteHtml(normalized)) hints.push('likely_incomplete_html')
  if (!/<\/html>/i.test(normalized)) hints.push('missing_html_closer')
  if (!hasTitleTag(normalized)) hints.push('title_missing')
  if (hasStreamingShellMarkers(normalized)) hints.push('streaming_shell')

  const byteLength = Buffer.byteLength(normalized, 'utf8')
  return [...new Set(hints), `body_bytes=${byteLength}`].join(' ')
}

function extractHtmlStatus(detail?: string): number | null {
  const match = String(detail || '').match(/\bhtml_status=(\d{3})\b/)
  return match ? Number(match[1]) : null
}

export function isRetryableValidationFailure(failure: ValidationFailureLike): boolean {
  if (failure.reason === 'non_200') {
    const status = extractHtmlStatus(failure.detail)
    return status !== null && isRetryableHttpStatus(status)
  }

  if (failure.reason === 'canonical_missing') {
    return /\blikely_incomplete_html\b|\bstreaming_shell\b/i.test(String(failure.detail || ''))
  }

  return false
}

export function summarizeRetryableFailures(failures: ValidationFailureLike[]): string {
  return failures
    .map((failure) => failure.detail || failure.reason)
    .slice(0, 3)
    .join('; ')
}
