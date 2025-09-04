import { MqttIngestionService } from './MqttIngestionService.js';
import { Kafka } from 'kafkajs';
import pino from 'pino';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    'MQTT_BROKER_URL',
    'KAFKA_BROKERS',
    'DATABASE_URL'
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
  }

  const kafka = new Kafka({
    clientId: 'mqtt-ingestion-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    retry: {
      initialRetryTime: 100,
      retries: 8
    }
  });

  const service = new MqttIngestionService({
    mqtt: {
      brokerUrl: process.env.MQTT_BROKER_URL!,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID || `mqtt-ingestion-${Date.now()}`
    },
    kafka,
    logger,
    database: {
      connectionString: process.env.DATABASE_URL!
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      await service.stop();
      process.exit(0);
    } catch (error) {
      logger.error(error, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logger.fatal(error, 'Uncaught Exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled Rejection');
    process.exit(1);
  });

  try {
    await service.start();
    logger.info('🚀 MQTT Ingestion Service is running');
  } catch (error) {
    logger.fatal(error, 'Failed to start MQTT Ingestion Service');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}