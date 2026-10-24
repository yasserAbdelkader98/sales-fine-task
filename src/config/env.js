require('dotenv').config({ quiet: true });

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
};
