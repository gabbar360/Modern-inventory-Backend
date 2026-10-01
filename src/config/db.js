import mongoose from 'mongoose';

const connectDB = async () => {
  const MONGO_URL = process.env.MONGO_URL;
  
  try {
    const conn = await mongoose.connect(MONGO_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host} / ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.warn(`[MongoDB] Connection Warning (${error.message}). Attempting fallback memory/local server...`);
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      const conn = await mongoose.connect(uri);
      console.log(`[MongoDB] Connected to Fallback In-Memory MongoDB: ${uri}`);
      return conn;
    } catch (fallbackErr) {
      console.error('[MongoDB] Connection Failed:', fallbackErr.message);
      process.exit(1);
    }
  }
};

export default connectDB;
