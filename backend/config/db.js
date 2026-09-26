const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { seedDatabase } = require('../utils/seed');

const shouldUseInMemoryFallback = ({ MONGO_URI, NODE_ENV } = process.env) => {
  const hasPersistentConnection = Boolean(MONGO_URI && String(MONGO_URI).trim());
  return !hasPersistentConnection && NODE_ENV !== 'production';
};

async function connectDB() {
  if (shouldUseInMemoryFallback(process.env)) {
    const memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri('skillforge');
    await mongoose.connect(memoryUri);
    await seedDatabase();
    console.log('MongoDB connected via in-memory server');
    return { useMemoryFallback: true, uri: memoryUri };
  }

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skillforge';
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
  return { useMemoryFallback: false, uri: mongoUri };
}

module.exports = connectDB;
module.exports.shouldUseInMemoryFallback = shouldUseInMemoryFallback;
