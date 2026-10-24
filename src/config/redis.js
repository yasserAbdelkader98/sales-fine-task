const Redis = require('ioredis');
const { redisUrl } = require('./env');

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 1000,
  commandTimeout: 1000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
  retryStrategy: () => 2000,
});

redis.on('ready', () => {
  console.log('Redis connection ready.');
});

redis.on('error', (error) => {
  console.warn('Redis connection error:', error.code || error.name);
});

module.exports = redis;
