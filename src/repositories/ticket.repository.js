const db = require('../config/db');

async function create(ticket) {
  const [createdTicket] = await db('tickets')
    .insert(ticket)
    .returning(['id', 'ticket_number', 'subject', 'description']);
  return createdTicket;
}

module.exports = { create };
