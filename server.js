/**
 * Vegnar ERP - Production Node.js + Express + MongoDB Server
 * Modularized MERN Stack Architecture
 */
import 'dotenv/config';
import app from './src/app.js';
import connectDB from './src/config/db.js';

const PORT = process.env.PORT || 8000;

// Start Server after connecting to MongoDB
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 [Vegnar MERN Server] Running on http://localhost:${PORT}`);
    console.log(`📊 [API Base] http://localhost:${PORT}/api`);
    console.log(`💓 [Health Check] http://localhost:${PORT}/api/health`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});
