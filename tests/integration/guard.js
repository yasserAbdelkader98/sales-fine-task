// Check before importing the app, dotenv, or database modules.
const expectedDatabase = 'postgresql://test_user@test-db:5432/sales_fine_test';
const expectedRedis = 'redis://test-redis:6379/0';

if (
  process.env.NODE_ENV !== 'test' ||
  process.env.INTEGRATION_TESTS !== '1' ||
  process.env.DATABASE_URL !== expectedDatabase ||
  process.env.REDIS_URL !== expectedRedis
) {
  throw new Error('Integration tests require the isolated docker-compose.test.yml stack. No connections opened.');
}
