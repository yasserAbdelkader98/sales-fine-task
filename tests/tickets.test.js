const request = require('supertest');
const app = require('../src/app');
const repository = require('../src/repositories/ticket.repository');

const validTicket = {
  ticket_number: 1001,
  subject: 'Cannot log in',
  description: 'My account rejects my password.',
};

describe('POST /api/v1/tickets', () => {
  test('creates a valid ticket and returns 201 with the saved record', async () => {
    const savedTicket = { id: 1, ...validTicket };
    repository.create.mockResolvedValue(savedTicket);

    const response = await request(app).post('/api/v1/tickets').send(validTicket);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(savedTicket);
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(validTicket);
  });

  test('does not pass unrecognized fields to the repository', async () => {
    repository.create.mockResolvedValue({ id: 1, ...validTicket });
    await request(app).post('/api/v1/tickets').send({ ...validTicket, id: 999, admin: true }).expect(201);

    expect(repository.create).toHaveBeenCalledWith(validTicket);
  });

  test.each(['ticket_number', 'subject', 'description'])('rejects missing %s', async (field) => {
    const body = { ...validTicket };
    delete body[field];
    const response = await request(app).post('/api/v1/tickets').send(body).expect(400);

    expect(response.body.error.details[field]).toEqual(expect.any(String));
    expect(repository.create).not.toHaveBeenCalled();
  });

  test.each([
    ['ticket_number', 0],
    ['ticket_number', -1],
    ['ticket_number', 1.5],
    ['ticket_number', '1001'],
    ['ticket_number', 2147483648],
    ['ticket_number', null],
    ['subject', ''],
    ['subject', ' \t\n '],
    ['subject', 42],
    ['subject', 'x'.repeat(256)],
    ['subject', 'bad\u0000text'],
    ['description', ''],
    ['description', ' \t\n '],
    ['description', null],
    ['description', 42],
    ['description', 'bad\u0000text'],
  ])('rejects invalid %s: %p', async (field, value) => {
    const response = await request(app).post('/api/v1/tickets')
      .send({ ...validTicket, [field]: value }).expect(400);

    expect(response.body.error.message).toBe('Validation failed');
    expect(response.body.error.details[field]).toEqual(expect.any(String));
    expect(repository.create).not.toHaveBeenCalled();
  });

  test('rejects a missing request body', async () => {
    const response = await request(app).post('/api/v1/tickets').expect(400);

    expect(response.body.error.message).toBe('Request body must be a JSON object.');
    expect(repository.create).not.toHaveBeenCalled();
  });

  test('rejects an array instead of an object', async () => {
    await request(app).post('/api/v1/tickets').send([]).expect(400);
    expect(repository.create).not.toHaveBeenCalled();
  });

  test('returns a JSON error for malformed JSON', async () => {
    const response = await request(app).post('/api/v1/tickets')
      .set('Content-Type', 'application/json').send('{').expect(400);

    expect(response.body).toEqual({ error: { message: 'Request body must contain valid JSON.' } });
    expect(repository.create).not.toHaveBeenCalled();
  });

  test('translates the PostgreSQL ticket-number unique violation into 409', async () => {
    repository.create.mockRejectedValue(Object.assign(new Error('Private database details'), {
      code: '23505', constraint: 'tickets_ticket_number_unique',
    }));

    const response = await request(app).post('/api/v1/tickets').send(validTicket).expect(409);

    expect(response.body).toEqual({ error: { message: 'A ticket with this ticket_number already exists.' } });
    expect(repository.create).toHaveBeenCalledWith(validTicket);
  });

  test('does not mislabel a different unique constraint as a duplicate ticket number', async () => {
    repository.create.mockRejectedValue(Object.assign(new Error('Private database details'), {
      code: '23505', constraint: 'tickets_pkey',
    }));
    const response = await request(app).post('/api/v1/tickets').send(validTicket).expect(500);

    expect(response.body).toEqual({ error: { message: 'Internal server error.' } });
  });

  test('hides unexpected database error details', async () => {
    repository.create.mockRejectedValue(new Error('Private connection details'));
    const response = await request(app).post('/api/v1/tickets').send(validTicket).expect(500);

    expect(response.body).toEqual({ error: { message: 'Internal server error.' } });
  });
});
