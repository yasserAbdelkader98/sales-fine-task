function validateTicket(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: { message: 'Request body must be a JSON object.' } });
  }

  const { ticket_number, subject, description } = body;
  const details = {};

  if (!Number.isInteger(ticket_number) || ticket_number < 1 || ticket_number > 2147483647) {
    details.ticket_number = 'Ticket number must be an integer between 1 and 2147483647.';
  }
  if (typeof subject !== 'string' || !subject.trim()) {
    details.subject = 'Subject must be a non-empty string.';
  } else if ([...subject].length > 255) {
    details.subject = 'Subject must not exceed 255 characters.';
  } else if (subject.includes('\u0000')) {
    details.subject = 'Subject must not contain null characters.';
  }
  if (typeof description !== 'string' || !description.trim()) {
    details.description = 'Description must be a non-empty string.';
  } else if (description.includes('\u0000')) {
    details.description = 'Description must not contain null characters.';
  }

  if (Object.keys(details).length) {
    return res.status(400).json({ error: { message: 'Validation failed', details } });
  }

  next();
}

module.exports = validateTicket;
