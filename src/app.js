const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes Mounting
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
