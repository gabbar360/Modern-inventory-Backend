import express from 'express';
import cors from 'cors';
import routes from './routes';
import { globalErrorHandler } from './core/errors/errorHandler';

const app = express();

// Global Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount Modular API v1 Routes
app.use('/api/v1', routes);

// Legacy route alias support
app.use('/api', routes);

// Global Error Handler
app.use(globalErrorHandler);

export default app;
