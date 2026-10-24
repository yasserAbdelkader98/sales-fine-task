module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/integration/guard.js'],
  testTimeout: 15000,
};
