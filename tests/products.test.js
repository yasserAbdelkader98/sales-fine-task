const request = require('supertest');
const app = require('../src/app');
const repository = require('../src/repositories/product.repository');
const redis = require('../src/config/redis');

const products = [
  { product_code: 'PRD-001', product_title: 'Keyboard', product_price: '49.99' },
];
const responseBody = {
  data: [{ ...products[0], product_price: 49.99 }],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
};
const key = 'products:v2:page:1:limit:10';

beforeEach(() => {
  repository.findPage.mockResolvedValue(products);
  repository.countAll.mockResolvedValue(1);
});

describe('GET /api/v1/products', () => {
  test('returns the correct product payload and pagination on a cache miss', async () => {
    const response = await request(app).get('/api/v1/products');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toEqual(responseBody);
    expect(redis.get).toHaveBeenCalledWith(key);
    expect(repository.findPage).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    expect(repository.findPage).toHaveBeenCalledTimes(1);
    expect(repository.countAll).toHaveBeenCalledTimes(1);
  });

  test('stores the entire response with an atomic 120-second expiration', async () => {
    await request(app).get('/api/v1/products').expect(200);

    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(key, JSON.stringify(responseBody), 'EX', 120);
  });

  test('returns cached data without querying PostgreSQL or resetting the TTL', async () => {
    const cached = {
      data: [{ product_code: 'CACHED', product_title: 'Cached product', product_price: 12 }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    const response = await request(app).get('/api/v1/products').expect(200);

    expect(response.body).toEqual(cached);
    expect(repository.findPage).not.toHaveBeenCalled();
    expect(repository.countAll).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  test('fetches fresh data when Redis reports that a previously cached key expired', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify(responseBody)).mockResolvedValueOnce(null);
    await request(app).get('/api/v1/products').expect(200);
    expect(repository.findPage).not.toHaveBeenCalled();

    const freshProducts = [{ ...products[0], product_title: 'Updated keyboard' }];
    repository.findPage.mockResolvedValue(freshProducts);
    const response = await request(app).get('/api/v1/products').expect(200);

    expect(response.body.data).toEqual([{ ...freshProducts[0], product_price: 49.99 }]);
    expect(repository.findPage).toHaveBeenCalledTimes(1);
    expect(repository.countAll).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(key, JSON.stringify(response.body), 'EX', 120);
  });

  test('uses the page and limit in both the cache key and database offset', async () => {
    repository.countAll.mockResolvedValue(3);
    const response = await request(app).get('/api/v1/products?page=2&limit=2').expect(200);

    expect(redis.get).toHaveBeenCalledWith('products:v2:page:2:limit:2');
    expect(repository.findPage).toHaveBeenCalledWith({ limit: 2, offset: 2 });
    expect(response.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  test('returns an empty page when there are no products', async () => {
    repository.findPage.mockResolvedValue([]);
    repository.countAll.mockResolvedValue(0);
    const response = await request(app).get('/api/v1/products').expect(200);

    expect(response.body).toEqual({
      data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  test('falls back to the repository when Redis is disconnected', async () => {
    redis.status = 'reconnecting';
    const response = await request(app).get('/api/v1/products').expect(200);

    expect(response.body).toEqual(responseBody);
    expect(repository.findPage).toHaveBeenCalledTimes(1);
    expect(repository.countAll).toHaveBeenCalledTimes(1);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  test('falls back to the repository when a Redis read fails', async () => {
    redis.get.mockRejectedValue(new Error('Redis unavailable'));
    const response = await request(app).get('/api/v1/products').expect(200);

    expect(response.body).toEqual(responseBody);
    expect(repository.findPage).toHaveBeenCalledTimes(1);
    expect(repository.countAll).toHaveBeenCalledTimes(1);
  });

  test('still returns database data when a cache write fails', async () => {
    redis.set.mockRejectedValue(new Error('Redis unavailable'));
    const response = await request(app).get('/api/v1/products').expect(200);

    expect(response.body).toEqual(responseBody);
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  test('replaces malformed cached JSON with a fresh database response', async () => {
    redis.get.mockResolvedValue('{invalid');
    const response = await request(app).get('/api/v1/products').expect(200);

    expect(response.body).toEqual(responseBody);
    expect(repository.findPage).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(key, JSON.stringify(responseBody), 'EX', 120);
  });

  test.each(['page=0', 'page=1.5', 'limit=101', 'limit=abc', 'page=1&page=2'])(
    'rejects invalid pagination: %s', async (query) => {
      const response = await request(app).get(`/api/v1/products?${query}`).expect(400);

      expect(response.body.error.message).toBe('Validation failed');
      expect(repository.findPage).not.toHaveBeenCalled();
      expect(repository.countAll).not.toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
    },
  );

  test('returns a generic error and does not cache a failed database query', async () => {
    repository.findPage.mockRejectedValue(new Error('Private database details'));
    const response = await request(app).get('/api/v1/products').expect(500);

    expect(response.body).toEqual({ error: { message: 'Internal server error.' } });
    expect(redis.set).not.toHaveBeenCalled();
  });
});
