import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.js';
import { deviceRoutes } from './routes/devices.js';
import { geofenceRoutes } from './routes/geofences.js';
import { eventRoutes } from './routes/events.js';
import { integrationRoutes } from './routes/integrations.js';
import { automationRoutes } from './routes/automations.js';
import { settingsRoutes } from './routes/settings.js';
import { initializeKafka, shutdownKafka } from './kafka/producer.js';
import { connectDb, disconnectDb } from './db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (3 levels up: dist -> apps/api -> root)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Security and performance middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

app.use(compression());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Rate limiting - more granular limits
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs for sensitive operations
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs for general operations
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply strict limiting to auth endpoints
app.use('/api/auth', strictLimiter);
// Apply general limiting to other API endpoints
app.use('/api/', generalLimiter);

app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/settings', settingsRoutes);

app.use(errorHandler);

// Initialize services
async function startServer() {
  try {
    // Initialize database connection
    await connectDb();
    console.log('✅ Database connected');

    // Initialize Kafka producer asynchronously (non-blocking)
    initializeKafka().then(() => {
      console.log('✅ Kafka producer initialized');
    }).catch((error) => {
      console.error('❌ Failed to initialize Kafka producer:', error);
      // Don't fail server startup if Kafka fails
    });

    const server = app.listen(PORT, () => {
      console.log(`🚀 API Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      console.log('🛑 Shutting down gracefully');
      server.close(async () => {
        try {
          await shutdownKafka();
          await disconnectDb();
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
