const path = require('node:path');
const { databaseUrl } = require('./src/config/env');

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for database commands. Set it in .env.');
}

module.exports = {
  development: {
    client: 'pg',
    connection: databaseUrl,
    migrations: {
      directory: path.join(__dirname, 'db', 'migrations'),
    },
    seeds: {
      directory: path.join(__dirname, 'db', 'seeds'),
    },
  },
};
