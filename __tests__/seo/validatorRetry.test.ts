import {
  buildCanonicalMissingDetail,
  isLikelyIncompleteHtml,
  isRetryableHttpStatus,
  isRetryableValidationFailure,
} from '@/lib/seo/validatorRetry'

describe('validatorRetry helpers', () => {
  it('marks gateway failures as retryable and client failures as non-retryable', () => {
    expect(isRetryableHttpStatus(502)).toBe(true)
    expect(isRetryableHttpStatus(503)).toBe(true)
    expect(isRetryableHttpStatus(404)).toBe(false)
  })

  it('flags streamed loading shells as incomplete html', () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <body>
          <main class="JobsLoading_page__KzFF6" aria-busy="true"></main>
          <template id="B:0"></template>
        </body>
      </html>
    `

    expect(isLikelyIncompleteHtml(html)).toBe(true)

    const detail = buildCanonicalMissingDetail(html)
    expect(detail).toContain('likely_incomplete_html')
    expect(detail).toContain('streaming_shell')
  })

  it('only retries canonical-missing failures when the html looked incomplete', () => {
    expect(
      isRetryableValidationFailure({
        reason: 'canonical_missing',
        detail: 'likely_incomplete_html streaming_shell body_bytes=2048',
      }),
    ).toBe(true)

    expect(
      isRetryableValidationFailure({
        reason: 'canonical_missing',
        detail: 'body_bytes=4096',
      }),
    ).toBe(false)

    expect(
      isRetryableValidationFailure({
        reason: 'non_200',
        detail: 'html_status=502',
      }),
    ).toBe(true)

    expect(
      isRetryableValidationFailure({
        reason: 'non_200',
        detail: 'html_status=404',
      }),
    ).toBe(false)
  })
})
