exports.up = function (knex) {
  return knex.schema.createTable('products', (table) => {
    table.increments('id');
    table.string('product_code').notNullable().unique();
    table.string('product_title').notNullable();
    table.decimal('product_price', 10, 2).notNullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('products');
};
