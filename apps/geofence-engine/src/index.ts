import { Kafka } from 'kafkajs';
import { Client } from 'pg';
import Redis from 'ioredis';
import pino from 'pino';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GeofenceProcessor } from './processors/GeofenceProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (3 levels up: dist -> apps/geofence-engine -> root)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function startGeofenceEngine() {
  try {
    // Initialize Kafka
    const kafka = new Kafka({
      clientId: 'geofence-engine',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      logLevel: 1 // Error level only
    });

    // Initialize PostgreSQL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    const pgClient = new Client({
      connectionString: databaseUrl,
      // Explicitly set SSL to false for local development
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    await pgClient.connect();

    // Initialize Redis
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    // Initialize geofence processor
    const processor = new GeofenceProcessor({
      kafka,
      pgClient,
      redis,
      logger
    });

    // Start processing
    await processor.start();

    logger.info('🚀 Geofence Engine started successfully');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('⏹️  Shutting down Geofence Engine...');
      await processor.stop();
      await pgClient.end();
      await redis.disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error(error, '💥 Failed to start Geofence Engine');
    process.exit(1);
  }
}

startGeofenceEngine();