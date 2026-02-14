import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stratix';

// Connection options for better reliability
const connectionOptions: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000, // How long to try selecting a server (5 seconds)
  socketTimeoutMS: 45000, // How long to wait for a socket to be established (45 seconds)
  connectTimeoutMS: 30000, // How long to wait for initial connection (30 seconds)
  maxPoolSize: 10, // Maximum number of connections in the connection pool
  minPoolSize: 5, // Minimum number of connections in the connection pool
  retryWrites: true, // Enable retryable writes
  retryReads: true, // Enable retryable reads
};

// Retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Calculate exponential backoff delay
 */
const getRetryDelay = (attempt: number): number => {
  return INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
};

/**
 * Connect to MongoDB with retry logic
 */
export const connectDatabase = async (): Promise<void> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI, connectionOptions);
      console.log('✅ MongoDB connected successfully');
      return; // Success, exit function
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ MongoDB connection attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed:`, lastError.message);

      // If not the last attempt, wait before retrying
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = getRetryDelay(attempt);
        console.log(`⏳ Retrying connection in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retry attempts failed
  console.error('❌ MongoDB connection failed after all retry attempts');
  console.error('Last error:', lastError);
  process.exit(1);
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected');
  } catch (error) {
    console.error('❌ MongoDB disconnection error:', error);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err: Error) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

