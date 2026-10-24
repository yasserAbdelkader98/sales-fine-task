const express = require('express');
const { getProducts } = require('../controllers/product.controller');
const validatePagination = require('../middleware/validate-pagination');

const router = express.Router();
router.get('/', validatePagination, getProducts);

module.exports = router;
