require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 8000,
  MONGO_URL: process.env.MONGO_URL || 'mongodb://localhost:27017/vegnar_crm',
  JWT_SECRET: process.env.JWT_SECRET || 'vegnar_erp_super_secret_jwt_key_2026_prod',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8000',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
