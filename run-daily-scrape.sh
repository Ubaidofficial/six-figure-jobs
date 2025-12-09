#!/bin/bash
cd /opt/job-board-scraper

echo "Running daily scrape..."
pnpm tsx scripts/discoverATSBulk.ts || true
pnpm tsx scripts/discoverATS.ts || true
pnpm tsx scripts/scrapeCareerPages.ts || true
pnpm tsx scripts/dailyScrapeV2.ts --mode=all --concurrency=6
