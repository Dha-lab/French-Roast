// Database Layer Configuration
// Modular architecture allowing in-memory store now and MongoDB/Mongoose connection later.

export const connectDB = async () => {
  console.log('⚡ Temporary In-Memory Data Store initialized for French Roast products & orders.');
  console.log('ℹ️ Modular database layer ready for future MongoDB connection.');
  return true;
};
