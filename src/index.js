const app = require('./app');
const { port } = require('./config/env');
const redis = require('./config/redis');
const db = require('./config/db');

redis.connect().catch(() => {
  console.warn('Redis unavailable; product requests will use PostgreSQL.');
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; waiting for active requests to finish.`);

  const deadline = setTimeout(() => {
    console.error('Shutdown timed out.');
    redis.disconnect();
    process.exit(1);
  }, 10000);
  deadline.unref();

  server.close(async (error) => {
    // Requests have drained, so no command still needs the Redis connection.
    redis.disconnect();
    try {
      await db.destroy();
      if (error) throw error;
      console.log('HTTP server and database/cache connections closed.');
    } catch (shutdownError) {
      console.error('Shutdown failed:', shutdownError.code || shutdownError.name);
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
