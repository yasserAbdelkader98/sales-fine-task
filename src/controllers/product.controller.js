const productService = require('../services/product.service');

async function getProducts(req, res) {
  const products = await productService.getProducts(res.locals.pagination);
  res.status(200).json(products);
}

module.exports = { getProducts };
