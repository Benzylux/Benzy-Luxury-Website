require('../../../loadEnv');

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'benzy_luxury';

let connectPromise = null;

async function connectCartDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectPromise) return connectPromise;

  connectPromise = mongoose.connect(MONGODB_URI, {
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
