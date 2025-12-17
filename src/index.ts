import express from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import v1Routes from './routes/v1';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// CORS configuration
const getAllowedOrigins = (): (string | RegExp)[] => {
  const origins: (string | RegExp)[] = [];
  
  // Add frontend URLs from environment (supports comma-separated)
  if (process.env.FRONTEND_URL) {
    const urls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
    origins.push(...urls);
  }
  
  // Allow all Vercel preview URLs (for preview deployments)
  origins.push(/^https:\/\/.*\.vercel\.app$/);
  
  // Add local development origins
  origins.push('http://localhost:5173');
  origins.push('http://localhost:3000');
  origins.push('http://127.0.0.1:5173');
  origins.push('http://127.0.0.1:3000');
  
  return origins;
};

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    const allowedOrigins = getAllowedOrigins();
    
    // Check if origin matches any allowed origin
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // In development, allow all origins for easier debugging
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️  CORS: Allowing origin ${origin} in development mode`);
        callback(null, true);
      } else {
        console.error(`❌ CORS: Blocked origin ${origin}`);
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Stratix API is running' });
});

// API Routes - Version 1
app.use('/api/v1', v1Routes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Connect to database
connectDatabase()
  .then(() => {
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api/${API_VERSION}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

export default app;

