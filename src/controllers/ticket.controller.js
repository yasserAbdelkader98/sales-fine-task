const ticketService = require('../services/ticket.service');

async function createTicket(req, res) {
  const ticket = await ticketService.createTicket(req.body);
  res.status(201).json(ticket);
}

module.exports = { createTicket };
