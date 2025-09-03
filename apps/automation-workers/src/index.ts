import { Kafka } from 'kafkajs';
import { Client } from 'pg';
import Redis from 'ioredis';
import Bull from 'bull';
import pino from 'pino';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AutomationWorker } from './workers/AutomationWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (3 levels up: dist -> apps/automation-workers -> root)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function startAutomationWorkers() {
  try {
    // Initialize Kafka
    const kafka = new Kafka({
      clientId: 'automation-workers',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      logLevel: 1
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

    // Initialize Bull queue
    const webhookQueue = new Bull('webhook queue', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        }
      }
    });

    // Initialize automation worker
    const worker = new AutomationWorker({
      kafka,
      pgClient,
      redis,
      webhookQueue,
      logger
    });

    // Start processing
    await worker.start();

    logger.info('🚀 Automation Workers started successfully');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('⏹️  Shutting down Automation Workers...');
      await worker.stop();
      await webhookQueue.close();
      await pgClient.end();
      await redis.disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error(error, '💥 Failed to start Automation Workers');
    process.exit(1);
  }
}

startAutomationWorkers();