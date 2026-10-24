const ticketRepository = require('../repositories/ticket.repository');

async function createTicket({ ticket_number, subject, description }) {
  try {
    return await ticketRepository.create({ ticket_number, subject, description });
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'tickets_ticket_number_unique') {
      const conflict = new Error('A ticket with this ticket_number already exists.');
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
}

module.exports = { createTicket };
