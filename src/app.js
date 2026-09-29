import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes Mounting
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

export default app;
