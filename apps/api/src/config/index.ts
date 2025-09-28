import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple paths to find the .env file
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'), // Current working directory
  path.resolve(__dirname, '../../../../../.env'), // Monorepo root from API
  path.resolve(__dirname, '../../../../.env'), // Alternative path
  path.resolve(__dirname, '../.env'), // API directory
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`✓ Loaded environment variables from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn(`⚠️  No .env file found in paths: ${possibleEnvPaths.join(', ')}`);
  console.warn('Using system environment variables only');
}

interface Config {
  // Node environment
  NODE_ENV: string;
  PORT: number;

  // Database
  DATABASE_URL: string;

  // JWT Authentication
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  // Encryption
  ENCRYPTION_KEY: string;

  // MQTT
  MQTT_BROKER_URL: string;
  MQTT_USERNAME?: string;
  MQTT_PASSWORD?: string;

  // Kafka
  KAFKA_BROKERS: string;
  KAFKA_CLIENT_ID: string;

  // Redis
  REDIS_URL: string;

  // API URLs
  API_BASE_URL: string;
  DASHBOARD_URL: string;

  // CORS
  ALLOWED_ORIGINS: string[];

  // OAuth Integrations
  NOTION_CLIENT_ID?: string;
  NOTION_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;

  // Twilio for WhatsApp
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;

  // Stripe
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // Maps
  MAPBOX_ACCESS_TOKEN?: string;
}

function validateConfig(): Config {
  const requiredVars = ['JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL'];

  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT_SECRET length
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  // Validate ENCRYPTION_KEY format
  const encryptionKey = process.env.ENCRYPTION_KEY!;
  if (encryptionKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 characters (32 bytes hex)');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    throw new Error('ENCRYPTION_KEY must be a valid hex string');
  }

  // Parse ALLOWED_ORIGINS
  const allowedOriginsStr =
    process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001';
  const allowedOrigins = allowedOriginsStr.split(',').map((origin) => origin.trim());

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),

    DATABASE_URL: process.env.DATABASE_URL!,

    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

    ENCRYPTION_KEY: encryptionKey,

    MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    MQTT_USERNAME: process.env.MQTT_USERNAME,
    MQTT_PASSWORD: process.env.MQTT_PASSWORD,

    KAFKA_BROKERS: process.env.KAFKA_BROKERS || 'localhost:9092',
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'geofence-app',

    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
    DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:3000',

    ALLOWED_ORIGINS: allowedOrigins,

    NOTION_CLIENT_ID: process.env.NOTION_CLIENT_ID,
    NOTION_CLIENT_SECRET: process.env.NOTION_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,

    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,

    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,

    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

    MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN,
  };
}

// Validate and export configuration
export const config = validateConfig();

// Export individual config sections for convenience
export const auth = {
  JWT_SECRET: config.JWT_SECRET,
  JWT_EXPIRES_IN: config.JWT_EXPIRES_IN,
  ENCRYPTION_KEY: config.ENCRYPTION_KEY,
  BETTER_AUTH_BASE_URL: config.API_BASE_URL,
  GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: config.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: config.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: config.GITHUB_CLIENT_SECRET,
};

export const database = {
  DATABASE_URL: config.DATABASE_URL,
};

export const messaging = {
  MQTT_BROKER_URL: config.MQTT_BROKER_URL,
  MQTT_USERNAME: config.MQTT_USERNAME,
  MQTT_PASSWORD: config.MQTT_PASSWORD,
  KAFKA_BROKERS: config.KAFKA_BROKERS,
  KAFKA_CLIENT_ID: config.KAFKA_CLIENT_ID,
  REDIS_URL: config.REDIS_URL,
};

export const oauth = {
  NOTION_CLIENT_ID: config.NOTION_CLIENT_ID,
  NOTION_CLIENT_SECRET: config.NOTION_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: config.GOOGLE_CLIENT_SECRET,
  SLACK_CLIENT_ID: config.SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET: config.SLACK_CLIENT_SECRET,
};

export const urls = {
  API_BASE_URL: config.API_BASE_URL,
  DASHBOARD_URL: config.DASHBOARD_URL,
  ALLOWED_ORIGINS: config.ALLOWED_ORIGINS,
};

export default config;
