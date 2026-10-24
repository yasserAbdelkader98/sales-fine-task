module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  resetMocks: true,
  restoreMocks: true,
};
