import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
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
import { trackConnectionUsage, getConnectionPoolStatus, cleanupConnectionTracker } from './middleware/connections.js';
import { authRoutes } from './routes/auth.js';
import { auth as authConfig } from '../auth.js';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { deviceRoutes } from './routes/devices.js';
import deviceGroupsRouter from './routes/deviceGroups.js';
import { geofenceRoutes } from './routes/geofences.js';
import { eventRoutes } from './routes/events.js';
import { automationRoutes, automationRulesRoutes } from './routes/automations.js';
import { settingsRoutes } from './routes/settings.js';
import { analyticsRoutes } from './routes/analytics.js';
import { apiKeyRoutes } from './routes/apiKeys.js';
import { initializeKafka, shutdownKafka } from './kafka/producer.js';
import { connectDb, disconnectDb } from '@geofence/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (3 levels up: dist -> apps/api -> root)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3002' // Frontend fallback port
    ],
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3001;

// Trust proxy for production deployment behind reverse proxy
// Configure for specific proxy setup (more secure than 'true')
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy only
} else {
  app.set('trust proxy', 'loopback'); // Trust only loopback for development
}

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Rate limiting - more granular limits with proper proxy handling
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

// // Apply strict limiting to auth endpoints
// app.use('/api/auth', strictLimiter);
// // Apply general limiting to other API endpoints
// app.use('/api/', generalLimiter);

app.all('/api/auth/*', toNodeHandler(authConfig));


app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connection tracking middleware (track all requests after this point)
app.use(trackConnectionUsage);

// Add admin endpoint for connection pool monitoring (requires admin authentication)
app.get('/admin/connection-pool', (req, res) => {
  // In production, add admin authentication check here
  getConnectionPoolStatus(req, res);
});

// WebSocket for real-time delivery updates
io.on('connection', (socket: Socket) => {
  console.log('Client connected to WebSocket');

  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    console.log(`Client joined room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Export io for use in routes
export { io };

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Custom auth routes (for legacy compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/device-groups', deviceGroupsRouter);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/automation-rules', automationRulesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/api-keys', apiKeyRoutes);

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

    server.listen(PORT, () => {
      console.log(`🚀 API Server with Socket.IO running on port ${PORT}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      console.log('🛑 Shutting down gracefully');
      server.close(async () => {
        try {
          cleanupConnectionTracker(); // Clean up connection tracking
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
