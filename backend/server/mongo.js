require('./loadEnv');

const { MongoClient, ServerApiVersion } = require('mongodb');

const MONGO_URL = String(process.env.MONGO_URL || process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'benzy_luxury';
const MONGODB_SERVER_SELECTION_TIMEOUT_MS = toPositiveInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 5000);
const MONGODB_CONNECT_TIMEOUT_MS = toPositiveInt(process.env.MONGODB_CONNECT_TIMEOUT_MS, 5000);
const MONGODB_SOCKET_TIMEOUT_MS = toPositiveInt(process.env.MONGODB_SOCKET_TIMEOUT_MS, 10000);
const MONGODB_HEALTHCHECK_INTERVAL_MS = toPositiveInt(process.env.MONGODB_HEALTHCHECK_INTERVAL_MS, 5000);
const MONGODB_HEALTHCHECK_TIMEOUT_MS = toPositiveInt(process.env.MONGODB_HEALTHCHECK_TIMEOUT_MS, 2500);

let client = null;
let db = null;
let initPromise = null;
let healthCheckPromise = null;
let mongoStatus = 'disconnected';
let lastHealthCheckAt = 0;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createMongoClient() {
  if (!MONGO_URL) {
    throw new Error('MONGO_URL, MONGO_URI, or MONGODB_URI environment variable is required.');
  }

  return new MongoClient(MONGO_URL, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    },
    serverSelectionTimeoutMS: MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: MONGODB_CONNECT_TIMEOUT_MS,
    socketTimeoutMS: MONGODB_SOCKET_TIMEOUT_MS
  });
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(label));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function ensureIndexes(database) {
  await Promise.all([
    database.collection('users').createIndex({ id: 1 }, { unique: true, sparse: true }),
    database.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
    database.collection('carts').createIndex({ userId: 1 }, { unique: true, sparse: true }),
    database.collection('carts').createIndex({ email: 1 }, { sparse: true }),
    database.collection('orders').createIndex({ orderId: 1 }, { unique: true, sparse: true }),
    database.collection('orders').createIndex({ customerEmail: 1 }),
    database.collection('subscribers').createIndex({ email: 1 }, { unique: true, sparse: true }),
    database.collection('subscribers').createIndex({ discountCode: 1 }, { unique: true, sparse: true }),
    database.collection('product_uploads').createIndex({ fileName: 1 }, { unique: true })
  ]);
}

async function closeMongoClient(activeClient) {
  if (!activeClient) return;

  try {
    await activeClient.close();
  } catch {
    // Ignore close failures during reconnect/shutdown cleanup.
  }
}

async function ensureHealthyMongoConnection() {
  if (!db) return false;

  const now = Date.now();
  if (mongoStatus === 'connected' && now - lastHealthCheckAt < MONGODB_HEALTHCHECK_INTERVAL_MS) {
    return true;
  }

  if (!healthCheckPromise) {
    healthCheckPromise = withTimeout(
      db.command({ ping: 1 }),
      MONGODB_HEALTHCHECK_TIMEOUT_MS,
      'MongoDB ping timed out.'
    )
      .then(() => {
        mongoStatus = 'connected';
        lastHealthCheckAt = Date.now();
        return true;
      })
      .catch(() => {
        mongoStatus = 'error';
        return false;
      })
      .finally(() => {
        healthCheckPromise = null;
      });
  }

  return healthCheckPromise;
}

async function reconnectMongo() {
  if (initPromise) return initPromise;

  const staleClient = client;
  client = null;
  db = null;
  healthCheckPromise = null;
  lastHealthCheckAt = 0;
  mongoStatus = 'connecting';

  let nextClient;
  try {
    nextClient = createMongoClient();
  } catch (error) {
    mongoStatus = 'error';
    throw error;
  }

  initPromise = (async () => {
    await closeMongoClient(staleClient);

    const connectedClient = await nextClient.connect();
    const connectedDb = connectedClient.db(MONGODB_DB_NAME);

    await ensureIndexes(connectedDb);

    client = connectedClient;
    db = connectedDb;
    mongoStatus = 'connected';
    lastHealthCheckAt = Date.now();
    return connectedDb;
  })().catch((error) => {
    client = null;
    db = null;
    initPromise = null;
    healthCheckPromise = null;
    lastHealthCheckAt = 0;
    mongoStatus = 'error';
    throw error;
  });

  return initPromise;
}

async function initializeMongo() {
  if (db) {
    const healthy = await ensureHealthyMongoConnection();
    if (healthy) return db;
  }

  if (initPromise) return initPromise;
  return reconnectMongo();
}

async function getCollection(name) {
  const database = await initializeMongo();
  return database.collection(name);
}

function getMongoStatus() {
  return mongoStatus;
}

function getMongoConfig() {
  return {
    dbName: MONGODB_DB_NAME
  };
}

async function closeMongo() {
  const activeClient = client;
  client = null;
  db = null;
  initPromise = null;
  healthCheckPromise = null;
  lastHealthCheckAt = 0;
  mongoStatus = 'disconnected';
  await closeMongoClient(activeClient);
}

module.exports = {
  closeMongo,
  getCollection,
  getMongoConfig,
  getMongoStatus,
  initializeMongo
};
