import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  try {
    // Attempt standard connection
    await mongoose.connect(env.MONGO_URL, { serverSelectionTimeoutMS: 3000 });
    console.log(`[Database] Successfully connected to MongoDB at ${env.MONGO_URL}`);
  } catch (err) {
    console.warn('[Database] Remote/Local MongoDB connection failed. Initializing MongoDB Memory Server fallback...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log(`[Database] Connected to in-memory MongoDB at ${uri}`);
    } catch (memErr) {
      console.error('[Database] Failed to initialize in-memory MongoDB fallback:', memErr);
    }
  }
}
