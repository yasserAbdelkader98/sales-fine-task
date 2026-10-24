const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const redis = require('../../src/config/redis');
const { spawn } = require('node:child_process');

const cacheKey = 'products:v2:page:1:limit:10';
const validTicket = { ticket_number: 1001, subject: 'Login issue', description: 'Cannot log in.' };
let queries = [];
const trackQuery = (query) => queries.push(query.sql);

beforeAll(async () => {
  await db.migrate.latest();
  await db.seed.run();
  await redis.connect();
  db.on('query', trackQuery);
});

beforeEach(async () => {
  // The guard and private Docker network restrict these writes to disposable data.
  await db('tickets').del();
  await redis.flushdb();
  queries = [];
});

afterAll(async () => {
  db.removeListener('query', trackQuery);
  redis.disconnect();
  await db.destroy();
});

describe('API with real isolated PostgreSQL and Redis', () => {
  test('migrations create the schema and repeated seeds do not duplicate products', async () => {
    await db.seed.run();
    expect(await db.schema.hasTable('tickets')).toBe(true);
    expect(Number((await db('products').count('* as total').first()).total)).toBe(3);
    const [completed, pending] = await db.migrate.list();
    expect(completed).toHaveLength(3);
    expect(pending).toHaveLength(0);
  });

  test('cache miss reads PostgreSQL, returns numeric prices, and sets a real 120-second TTL', async () => {
    const response = await request(app).get('/api/v1/products').expect(200);

    expect(response.body.data).toEqual([
      { product_code: 'PRD-001', product_title: 'Keyboard', product_price: 49.99 },
      { product_code: 'PRD-002', product_title: 'Mouse', product_price: 24.99 },
      { product_code: 'PRD-003', product_title: 'Monitor', product_price: 199.99 },
    ]);
    expect(response.body.pagination).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
    expect(queries.filter((sql) => sql.includes('"products"'))).toHaveLength(2);
    expect(JSON.parse(await redis.get(cacheKey))).toEqual(response.body);
    const ttl = await redis.ttl(cacheKey);
    expect(ttl).toBeGreaterThan(110);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  test('cache hit performs no SQL queries and does not reset expiration', async () => {
    const initial = await request(app).get('/api/v1/products').expect(200);
    await redis.expire(cacheKey, 60);
    queries = [];

    const cached = await request(app).get('/api/v1/products').expect(200);

    expect(cached.body).toEqual(initial.body);
    expect(queries).toEqual([]);
    expect(await redis.ttl(cacheKey)).toBeLessThanOrEqual(60);
  });

  test('real Redis expiration causes a fresh database fetch', async () => {
    await request(app).get('/api/v1/products').expect(200);
    await db('products').where({ product_code: 'PRD-001' }).update({ product_title: 'Updated keyboard' });
    try {
      // Verify expiry behavior without making the suite wait two minutes.
      await redis.pexpire(cacheKey, 1);
      const deadline = Date.now() + 3000;
      while (await redis.exists(cacheKey)) {
        if (Date.now() > deadline) throw new Error('Test cache key did not expire.');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      queries = [];
      const fresh = await request(app).get('/api/v1/products').expect(200);
      expect(fresh.body.data[0].product_title).toBe('Updated keyboard');
      expect(queries.filter((sql) => sql.includes('"products"'))).toHaveLength(2);
      expect(await redis.ttl(cacheKey)).toBeGreaterThan(110);
    } finally {
      await db('products').where({ product_code: 'PRD-001' }).update({ product_title: 'Keyboard' });
    }
  });

  test('pagination executes the real limit and offset queries', async () => {
    const response = await request(app).get('/api/v1/products?page=2&limit=2').expect(200);
    expect(response.body.data).toEqual([
      { product_code: 'PRD-003', product_title: 'Monitor', product_price: 199.99 },
    ]);
    expect(response.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  test('API still queries PostgreSQL when its real Redis connection is closed', async () => {
    await redis.quit();
    try {
      const response = await request(app).get('/api/v1/products').expect(200);
      expect(response.body.data).toHaveLength(3);
      expect(queries.filter((sql) => sql.includes('"products"'))).toHaveLength(2);
    } finally {
      await redis.connect();
    }
  });

  test('creates and persists a ticket, then rejects a duplicate with 409', async () => {
    const created = await request(app).post('/api/v1/tickets').send(validTicket).expect(201);
    expect(created.body).toEqual({ id: expect.any(Number), ...validTicket });
    expect(await db('tickets').where({ id: created.body.id }).first()).toEqual(created.body);
    await request(app).post('/api/v1/tickets').send(validTicket).expect(409);
    expect(Number((await db('tickets').count('* as total').first()).total)).toBe(1);
  });

  test('concurrent submissions cannot create duplicate ticket numbers', async () => {
    const responses = await Promise.all([
      request(app).post('/api/v1/tickets').send(validTicket),
      request(app).post('/api/v1/tickets').send(validTicket),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(Number((await db('tickets').count('* as total').first()).total)).toBe(1);
  });

  test('invalid input returns 400 without inserting records', async () => {
    await request(app).post('/api/v1/tickets').send({ ...validTicket, subject: ' ' }).expect(400);
    await request(app).post('/api/v1/tickets').send({}).expect(400);
    expect(Number((await db('tickets').count('* as total').first()).total)).toBe(0);
  });

  test('PostgreSQL itself enforces positive numbers and non-empty ticket text', async () => {
    await expect(db('tickets').insert({ ...validTicket, ticket_number: 0 }))
      .rejects.toMatchObject({ code: '23514', constraint: 'tickets_ticket_number_positive' });
    await expect(db('tickets').insert({ ...validTicket, subject: ' ' }))
      .rejects.toMatchObject({ code: '23514', constraint: 'tickets_subject_non_empty' });
    await expect(db('tickets').insert({ ...validTicket, description: '\t\n' }))
      .rejects.toMatchObject({ code: '23514', constraint: 'tickets_description_non_empty' });
  });

  test('server starts without Redis and exits cleanly on SIGTERM', async () => {
    const child = spawn(process.execPath, ['src/index.js'], {
      env: { ...process.env, PORT: '18081', REDIS_URL: 'redis://test-redis:6399/0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const exited = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server startup timed out.')), 5000);
        child.stdout.on('data', () => {
          if (output.includes('API listening')) {
            clearTimeout(timeout);
            resolve();
          }
        });
        exited.then(() => { clearTimeout(timeout); reject(new Error('Server exited before readiness.')); }, reject);
      });

      const response = await fetch('http://127.0.0.1:18081/api/v1/products', {
        signal: AbortSignal.timeout(5000),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).data).toHaveLength(3);
      child.kill('SIGTERM');
      const result = await exited;
      expect(result).toEqual({ code: 0, signal: null });
      expect(output).toContain('HTTP server and database/cache connections closed.');
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await exited;
    }
  });
});
