const db = require('../config/db');

function findPage({ limit, offset }) {
  return db('products')
    .select('product_code', 'product_title', 'product_price')
    .orderBy('product_code')
    .limit(limit)
    .offset(offset);
}

async function countAll() {
  const { total } = await db('products').count('* as total').first();
  return Number(total);
}

module.exports = { findPage, countAll };
