exports.seed = function (knex) {
  return knex('products')
    .insert([
      { product_code: 'PRD-001', product_title: 'Keyboard', product_price: '49.99' },
      { product_code: 'PRD-002', product_title: 'Mouse', product_price: '24.99' },
      { product_code: 'PRD-003', product_title: 'Monitor', product_price: '199.99' },
    ])
    .onConflict('product_code')
    .ignore();
};
