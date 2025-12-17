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
  
  // Parse CORS origins from environment variable
  // Supports JSON array format: ["https://example.com", "https://another.com"]
  // Or comma-separated format: https://example.com,https://another.com
  if (process.env.CORS_ORIGINS) {
    try {
      // Try parsing as JSON array first
      const parsed = JSON.parse(process.env.CORS_ORIGINS);
      if (Array.isArray(parsed)) {
        origins.push(...parsed.map((url: string) => url.trim().replace(/\/+$/, '')));
      } else {
        // Fallback to comma-separated
        const urls = process.env.CORS_ORIGINS.split(',').map((url: string) => url.trim().replace(/\/+$/, ''));
        origins.push(...urls);
      }
    } catch {
      // If JSON parsing fails, treat as comma-separated
      const urls = process.env.CORS_ORIGINS.split(',').map((url: string) => url.trim().replace(/\/+$/, ''));
      origins.push(...urls);
    }
  }
  
  // Legacy support: FRONTEND_URL (for backward compatibility)
  if (process.env.FRONTEND_URL) {
    const urls = process.env.FRONTEND_URL.split(',').map((url: string) => url.trim().replace(/\/+$/, ''));
    origins.push(...urls);
  }
  
  // Allow all Vercel preview URLs (for preview deployments)
  origins.push(/^https:\/\/.*\.vercel\.app$/);
  
  // Add local development origins
  origins.push('http://localhost:5173');
  origins.push('http://localhost:3000');
  origins.push('http://127.0.0.1:5173');
  origins.push('http://127.0.0.1:3000');
  
  // Log configured origins in production for debugging
  if (process.env.NODE_ENV === 'production') {
    console.log('🔒 CORS Configuration:');
    console.log('  Allowed Origins:', origins.map(o => typeof o === 'string' ? o : o.toString()));
    console.log('  CORS_ORIGINS:', process.env.CORS_ORIGINS || 'not set');
    console.log('  FRONTEND_URL:', process.env.FRONTEND_URL || 'not set');
  }
  
  return origins;
};

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Normalize origin (remove trailing slash, convert to lowercase for comparison)
    const normalizedOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();
    
    const allowedOrigins = getAllowedOrigins();
    
    // Check if origin matches any allowed origin
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        // Normalize allowed origin for comparison
        const normalizedAllowed = allowedOrigin.trim().replace(/\/+$/, '').toLowerCase();
        return normalizedOrigin === normalizedAllowed;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin); // Test original origin (case-sensitive for regex)
      }
      return false;
    });
    
    if (isAllowed) {
      if (process.env.NODE_ENV === 'production') {
        console.log(`✅ CORS: Allowed origin ${origin}`);
      }
      callback(null, true);
    } else {
      // In development, allow all origins for easier debugging
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️  CORS: Allowing origin ${origin} in development mode`);
        callback(null, true);
      } else {
        console.error(`❌ CORS: Blocked origin ${origin}`);
        console.error(`   Configured origins:`, allowedOrigins.map(o => typeof o === 'string' ? o : o.toString()));
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

