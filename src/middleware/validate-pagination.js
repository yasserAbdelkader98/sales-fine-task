function validatePagination(req, res, next) {
  const { page = '1', limit = '10' } = req.query;
  const details = {};
  const pageNumber = Number(page);
  const pageSize = Number(limit);

  if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(pageNumber)) {
    details.page = 'Page must be a positive integer.';
  }
  if (typeof limit !== 'string' || !/^[1-9]\d*$/.test(limit) || !Number.isSafeInteger(pageSize) || pageSize > 100) {
    details.limit = 'Limit must be an integer between 1 and 100.';
  }
  if (!Object.keys(details).length && !Number.isSafeInteger((pageNumber - 1) * pageSize)) {
    details.page = 'Page is too large for the requested limit.';
  }

  if (Object.keys(details).length) {
    return res.status(400).json({ error: { message: 'Validation failed', details } });
  }

  res.locals.pagination = { page: pageNumber, limit: pageSize };
  next();
}

module.exports = validatePagination;
