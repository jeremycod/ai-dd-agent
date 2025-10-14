module.exports = {
  displayName: 'E2E Tests (Minimal)',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/workflows/*.test.ts', '**/mocks/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testTimeout: 10000,
  verbose: true
};