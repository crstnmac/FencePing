import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import pino from 'pino';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AutomationProcessor } from './AutomationProcessor.js';
import { WebhookWorker } from './WebhookWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard'
    }
  } : undefined
});

async function main() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'KAFKA_BROKERS',
    'REDIS_URL'
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
  }

  // Database connection
  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test database connection
  try {
    await dbPool.query('SELECT NOW()');
    logger.info('✅ Database connection established');
  } catch (error) {
    logger.fatal({ error }, 'Failed to connect to database');
    process.exit(1);
  }

  // Kafka setup
  const kafka = new Kafka({
    clientId: 'automation-workers',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    retry: {
      initialRetryTime: 100,
      retries: 8
    }
  });

  // Redis configuration for Bull queues
  const parseRedisUrl = (url: string) => {
    if (url.startsWith('redis://')) {
      const urlObj = new URL(url);
      return {
        host: urlObj.hostname || 'localhost',
        port: parseInt(urlObj.port || '6379'),
        password: urlObj.password || undefined,
        db: parseInt(urlObj.pathname.slice(1) || '0')
      };
    }
    // Fallback to individual env vars
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    };
  };

  const redisConfig = process.env.REDIS_URL 
    ? parseRedisUrl(process.env.REDIS_URL)
    : {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      };

  // Initialize services
  const automationProcessor = new AutomationProcessor(kafka, dbPool, logger, redisConfig);
  const webhookWorker = new WebhookWorker(dbPool, logger, redisConfig);

  // Health check endpoint (if running as HTTP service)
  if (process.env.ENABLE_HEALTH_CHECK === 'true') {
    const express = require('express');
    const app = express();
    
    // Trust proxy for production deployment behind reverse proxy
    if (process.env.NODE_ENV === 'production') {
      app.set('trust proxy', 1); // Trust first proxy only
    } else {
      app.set('trust proxy', 'loopback'); // Trust only loopback for development
    }
    
    app.get('/health', (req: any, res: any) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          automationProcessor: automationProcessor.isHealthy(),
          webhookWorker: true, // WebhookWorker doesn't have isHealthy method yet
          database: dbPool.totalCount > 0
        },
        metrics: {
          automationProcessor: automationProcessor.getMetrics(),
          database: {
            totalConnections: dbPool.totalCount,
            idleConnections: dbPool.idleCount,
            waitingCount: dbPool.waitingCount
          }
        }
      };

      const allHealthy = Object.values(health.services).every(status => status);
      res.status(allHealthy ? 200 : 503).json(health);
    });

    const port = process.env.HEALTH_PORT || 8080;
    app.listen(port, () => {
      logger.info(`Health check server running on port ${port}`);
    });
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      await Promise.all([
        automationProcessor.stop(),
        webhookWorker.shutdown()
      ]);
      
      await dbPool.end();
      logger.info('Database connections closed');
      
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught Exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled Rejection');
    process.exit(1);
  });

  // Start services
  try {
    logger.info('🚀 Starting automation workers...');
    
    await automationProcessor.start();
    logger.info('✅ Automation processor started');

    // WebhookWorker is automatically started when instantiated
    logger.info('✅ Webhook worker started');
    
    logger.info('🎉 All automation workers are running successfully');
    
    // Keep process alive
    await new Promise(() => {}); // This will run indefinitely
    
  } catch (error) {
    logger.fatal({ error }, 'Failed to start automation workers');
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };