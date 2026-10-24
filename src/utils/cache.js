const redis = require('../config/redis');
const CACHE_TTL_SECONDS = 120;

async function getJson(key) {
  if (redis.status !== 'ready') {
    console.log(`[cache] BYPASS ${key}: Redis is not ready.`);
    return null;
  }

  try {
    const cached = await redis.get(key);
    if (cached === null) {
      console.log(`[cache] MISS ${key}`);
      return null;
    }

    const value = JSON.parse(cached);
    console.log(`[cache] HIT ${key}`);
    return value;
  } catch (error) {
    console.warn(`[cache] READ FAILED ${key}:`, error.code || error.name);
    return null;
  }
}

async function setJson(key, value) {
  if (redis.status !== 'ready') {
    console.log(`[cache] WRITE SKIPPED ${key}: Redis is not ready.`);
    return;
  }

  try {
    await redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    console.log(`[cache] STORED ${key}: TTL ${CACHE_TTL_SECONDS}s`);
  } catch (error) {
    console.warn(`[cache] WRITE FAILED ${key}:`, error.code || error.name);
  }
}

module.exports = { getJson, setJson };
