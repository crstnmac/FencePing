import { Kafka } from 'kafkajs';
import { Client } from 'pg';
import Redis from 'ioredis';
import pino from 'pino';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GeofenceProcessor } from './processors/GeofenceProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const logger = pino({
  name: 'geofence-engine',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Configuration
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/geofence_dev';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class GeofenceEngineService {
  private geofenceProcessor: GeofenceProcessor | null = null;
  private isShuttingDown = false;

  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Geofence Engine Service...');

      // Initialize Kafka
      const kafka = new Kafka({
        clientId: 'geofence-engine',
        brokers: KAFKA_BROKERS,
        connectionTimeout: 10000,
        requestTimeout: 30000,
        retry: {
          initialRetryTime: 100,
          retries: 8
        }
      });

      // Initialize database connection
      const pgClient = new Client({ connectionString: DATABASE_URL });
      await pgClient.connect();
      logger.info('✅ Database connected');

      // Initialize Redis
      const redis = new Redis(REDIS_URL);
      logger.info('✅ Redis connected');

      // Initialize GeofenceProcessor
      this.geofenceProcessor = new GeofenceProcessor({
        kafka,
        pgClient,
        redis,
        logger
      });

      await this.geofenceProcessor.start();

      logger.info('✅ Geofence Engine Service started successfully');

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error(error, '❌ Failed to start Geofence Engine Service:');
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT'] as const;

    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`📨 Received ${signal}, shutting down gracefully...`);
        await this.shutdown();
      });
    });

    process.on('uncaughtException', async (error) => {
      logger.error(error, 'Uncaught exception:');
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      logger.error(reason, 'Unhandled rejection:');
      await this.shutdown();
      process.exit(1);
    });
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('🛑 Shutting down Geofence Engine Service...');

    try {
      if (this.geofenceProcessor) {
        await this.geofenceProcessor.stop();
        logger.info('✅ Geofence processor stopped');
      }

      logger.info('✅ Geofence Engine Service shutdown complete');

    } catch (error) {
      logger.error(error, 'Error during shutdown:');
    } finally {
      process.exit(0);
    }
  }
}

// Start the service
async function main() {
  const service = new GeofenceEngineService();

  try {
    await service.start();
  } catch (error) {
    logger.error(error, 'Failed to start service:');
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Unhandled error in main:', error);
  process.exit(1);
});