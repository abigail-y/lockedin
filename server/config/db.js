const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the URI in .env
 * Exits the process on failure so the server doesn't silently run without a DB.
 */
async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;
