#!/bin/bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://www.6figjobs.com}"

ROUTES=(
  "/"
  "/jobs"
  "/jobs/100k-plus"
  "/jobs/200k-plus"
  "/jobs/300k-plus"
  "/jobs/400k-plus"
  "/remote"
  "/remote/software-engineer"
)

failures=0

echo "=========================================="
echo "Running production smoke checks"
echo "Base URL: ${BASE_URL}"
echo "=========================================="

for route in "${ROUTES[@]}"; do
  tmp_body="$(mktemp)"
  url="${BASE_URL}${route}"
  http_code="$(curl -sS -L -o "${tmp_body}" -w "%{http_code}" "${url}")"

  if [[ "${http_code}" -lt 200 || "${http_code}" -ge 400 ]]; then
    echo "FAIL ${route} (HTTP ${http_code})"
    failures=$((failures + 1))
    rm -f "${tmp_body}"
    continue
  fi

  if grep -Eq 'Application error: a server-side exception has occurred|Digest:|temporarily unavailable' "${tmp_body}"; then
    echo "FAIL ${route} (response contains crash/fallback marker)"
    failures=$((failures + 1))
    rm -f "${tmp_body}"
    continue
  fi

  echo "OK   ${route}"
  rm -f "${tmp_body}"
done

if [[ "${failures}" -gt 0 ]]; then
  echo "Smoke checks failed: ${failures} route(s) need attention."
  exit 1
fi

echo "Smoke checks passed."
