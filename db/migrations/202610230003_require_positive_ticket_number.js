exports.up = function (knex) {
  return knex.schema.alterTable('tickets', (table) => {
    table.check('ticket_number > 0', [], 'tickets_ticket_number_positive');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tickets', (table) => {
    table.dropChecks('tickets_ticket_number_positive');
  });
};
