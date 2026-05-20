require('../../../loadEnv');

const mongoose = require('mongoose');

const MONGO_URL = String(process.env.MONGO_URL || '').trim();
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'benzy_luxury';

let connectPromise = null;

async function connectCartDatabase() {
  if (!MONGO_URL) {
    throw new Error('MONGO_URL environment variable is required.');
  }

  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectPromise) return connectPromise;

  connectPromise = mongoose.connect(MONGO_URL, {
    dbName: MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 5000
  }).finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

async function closeCartDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
}

module.exports = {
  closeCartDatabase,
  connectCartDatabase
};
