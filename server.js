/**
 * Vegnar ERP - Production Node.js + Express + MongoDB Server
 * Modularized MERN Stack Architecture
 */

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { PORT } = require('./src/config/env');

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
