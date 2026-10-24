const express = require('express');
const healthRoutes = require('./routes/health.routes');
const productRoutes = require('./routes/product.routes');
const ticketRoutes = require('./routes/ticket.routes');
const errorHandler = require('./middleware/error-handler');

const app = express();

app.use(express.json());
app.use('/health', healthRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/tickets', ticketRoutes);

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Route not found.' } });
});
app.use(errorHandler);

module.exports = app;
