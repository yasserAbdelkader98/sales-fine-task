const express = require('express');
const { createTicket } = require('../controllers/ticket.controller');
const validateTicket = require('../middleware/validate-ticket');

const router = express.Router();
router.post('/', validateTicket, createTicket);

module.exports = router;
