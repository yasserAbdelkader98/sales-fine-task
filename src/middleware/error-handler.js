function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body must contain valid JSON.' } });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Request body is too large.' } });
  }
  if (error.status === 409) {
    return res.status(409).json({ error: { message: error.message } });
  }
  if (error.status === 415) {
    return res.status(415).json({ error: { message: 'Unsupported request encoding.' } });
  }

  console.error('Request failed:', error.code || error.name);
  res.status(500).json({ error: { message: 'Internal server error.' } });
}

module.exports = errorHandler;
