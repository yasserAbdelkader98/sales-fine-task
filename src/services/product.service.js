const productRepository = require('../repositories/product.repository');
const cache = require('../utils/cache');

async function getProducts({ page, limit }) {
  const cacheKey = `products:v2:page:${page}:limit:${limit}`;

  const cached = await cache.getJson(cacheKey);
  if (cached !== null) return cached;

  console.log(`[products cache] DATABASE FETCH ${cacheKey}`);
  const offset = (page - 1) * limit;
  const [products, total] = await Promise.all([
    productRepository.findPage({ limit, offset }),
    productRepository.countAll(),
  ]);

  const response = {
    data: products.map((product) => ({
      ...product,
      product_price: Number(product.product_price),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };

  await cache.setJson(cacheKey, response);

  return response;
}

module.exports = { getProducts };
