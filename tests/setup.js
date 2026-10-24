// Explicit factories prevent the real modules from loading or connecting.
jest.mock('../src/config/db', () => {
  throw new Error('Real database access is forbidden in this mocked test suite.');
});

jest.mock('../src/repositories/product.repository', () => ({
  findPage: jest.fn(),
  countAll: jest.fn(),
}));

jest.mock('../src/repositories/ticket.repository', () => ({
  create: jest.fn(),
}));

jest.mock('../src/config/redis', () => ({
  status: 'ready',
  get: jest.fn(),
  set: jest.fn(),
}));

const redis = require('../src/config/redis');

beforeEach(() => {
  redis.status = 'ready';
  redis.get.mockResolvedValue(null);
  redis.set.mockResolvedValue('OK');

  // Keep expected cache/error messages out of the test report.
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
