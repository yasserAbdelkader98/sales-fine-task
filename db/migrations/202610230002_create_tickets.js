exports.up = function (knex) {
  return knex.schema.createTable('tickets', (table) => {
    table.increments('id');
    table.integer('ticket_number').notNullable().unique();
    table.string('subject').notNullable();
    table.text('description').notNullable();

    table.check("subject ~ '[^[:space:]]'", [], 'tickets_subject_non_empty');
    table.check("description ~ '[^[:space:]]'", [], 'tickets_description_non_empty');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tickets');
};
