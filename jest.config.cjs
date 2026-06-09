module.exports = {
  testEnvironment: 'node',
  watchman: false,
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Runs before each test file's modules load — sets INDEXING_PHASE=2 so
  // sitemap-route tests exercise URL-emission logic rather than the Phase 1
  // silencing. The phase silencing itself is covered by indexingPhase.test.ts.
  setupFiles: ['<rootDir>/jest.setup.js'],
}
