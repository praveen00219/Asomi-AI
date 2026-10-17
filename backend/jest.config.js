/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Runs before the test framework, so config.ts sees a sane env on first import.
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  clearMocks: true,
  // Nothing in the test suite touches the network, so a short timeout keeps a
  // stray real API call from hanging CI instead of failing it.
  testTimeout: 10000,
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
};
