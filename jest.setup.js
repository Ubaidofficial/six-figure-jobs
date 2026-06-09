// jest.setup.js
//
// Runs before every test file (via setupFiles in jest.config.cjs). Sets the
// indexing phase to 2 so sitemap-route tests exercise URL-emission logic
// rather than the Phase 1 silencing path. The phase silencing itself is
// covered in __tests__/seo/indexingPhase.test.ts, which sets the env
// per-test via __resetIndexingPhaseCacheForTests().
//
// Setting it here, before any test file imports lib/seo/indexingPhase, is
// important because that module caches the phase value lazily on first
// access for performance.

process.env.INDEXING_PHASE = '2'
