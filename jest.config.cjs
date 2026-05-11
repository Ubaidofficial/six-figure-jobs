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
}
