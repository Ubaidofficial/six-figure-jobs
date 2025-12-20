# Scraper Specification

**Last Updated:** December 20, 2025

## Coverage
- 17 board scrapers
- 247 ATS companies  
- 1,160 generic sources
- Total: 1,701 companies

## Active Scrapers
RemoteOK, WeWorkRemotely, NoDesk, BuiltIn, Remote100k, RemoteRocketship, Himalayas (NEW), RemoteLeaf (NEW), JustJoin, Remotive, YCombinator, RemoteYeah (NEW)

## Error Handling
All scrapers use try-catch pattern.

## Daily Execution
npx tsx scripts/dailyScrapeV2.ts --mode=all
Runtime: 45-60 minutes
