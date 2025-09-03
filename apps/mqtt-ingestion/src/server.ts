import * as mqtt from 'mqtt';
import { Kafka, Producer } from 'kafkajs';
import { z } from 'zod';
import pino from 'pino';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const logger = pino({ name: 'mqtt-ingestion' });

// Configuration
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const DEVICE_LOCATION_TOPIC = 'devices/+/location';
const KAFKA_RAW_EVENTS_TOPIC = 'raw_events';

// Validation schemas
const DeviceLocationSchema = z.object({
  device_id: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracy: z.number().positive().optional(),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  timestamp: z.string().datetime().optional(),
  battery_level: z.number().min(0).max(100).optional(),
  signal_strength: z.number().optional()
});

const DeviceStatusSchema = z.object({
  device_id: z.string().uuid(),
  status: z.enum(['online', 'offline', 'low_battery', 'charging']),
  battery_level: z.number().min(0).max(100).optional(),
  signal_strength: z.number().optional(),
  timestamp: z.string().datetime().optional()
});

type DeviceLocation = z.infer<typeof DeviceLocationSchema>;
type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

class MQTTIngestionService {
  private mqttClient: mqtt.MqttClient | null = null;
  private kafkaProducer: Producer | null = null;
  private kafka: Kafka;
  private isShuttingDown = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'mqtt-ingestion-service',
      brokers: KAFKA_BROKERS,
      connectionTimeout: 10000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting MQTT Ingestion Service...');
      
      // Initialize Kafka producer
      await this.initializeKafka();
      
      // Initialize MQTT client
      await this.initializeMQTT();
      
      logger.info('✅ MQTT Ingestion Service started successfully');
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      logger.error('Failed to start MQTT Ingestion Service:', error);
      throw error;
    }
  }

  private async initializeKafka(): Promise<void> {
    try {
      this.kafkaProducer = this.kafka.producer({
        transactionTimeout: 30000,
        idempotent: true,
        maxInFlightRequests: 5,
        retry: {
          initialRetryTime: 100,
          retries: 5
        }
      });

      await this.kafkaProducer.connect();
      logger.info('✅ Kafka producer connected');
    } catch (error) {
      logger.error('Failed to initialize Kafka:', error);
      throw error;
    }
  }

  private async initializeMQTT(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.mqttClient = mqtt.connect(MQTT_BROKER_URL, {
          clientId: `mqtt-ingestion-${Date.now()}`,
          clean: true,
          connectTimeout: 10000,
          keepalive: 60,
          reconnectPeriod: 5000,
          will: {
            topic: 'services/mqtt-ingestion/status',
            payload: JSON.stringify({ status: 'offline', timestamp: new Date().toISOString() }),
            qos: 1,
            retain: true
          }
        });

        this.mqttClient.on('connect', () => {
          logger.info('✅ MQTT client connected to broker');
          
          // Subscribe to device location updates
          this.mqttClient!.subscribe(DEVICE_LOCATION_TOPIC, { qos: 1 }, (err) => {
            if (err) {
              logger.error('Failed to subscribe to device location topic:', err);
              reject(err);
            } else {
              logger.info(`📡 Subscribed to topic: ${DEVICE_LOCATION_TOPIC}`);
            }
          });

          // Subscribe to device status updates
          this.mqttClient!.subscribe('devices/+/status', { qos: 1 }, (err) => {
            if (err) {
              logger.error('Failed to subscribe to device status topic:', err);
            } else {
              logger.info('📡 Subscribed to topic: devices/+/status');
            }
          });

          // Publish service status
          this.mqttClient!.publish(
            'services/mqtt-ingestion/status',
            JSON.stringify({ status: 'online', timestamp: new Date().toISOString() }),
            { qos: 1, retain: true }
          );

          resolve();
        });

        this.mqttClient.on('message', this.handleMQTTMessage.bind(this));
        this.mqttClient.on('error', this.handleMQTTError.bind(this));
        this.mqttClient.on('reconnect', () => logger.info('🔄 MQTT client reconnecting...'));
        this.mqttClient.on('offline', () => logger.warn('⚠️ MQTT client offline'));

      } catch (error) {
        logger.error('Failed to initialize MQTT:', error);
        reject(error);
      }
    });
  }

  private async handleMQTTMessage(topic: string, message: Buffer): Promise<void> {
    try {
      if (this.isShuttingDown) {
        return;
      }

      const payload = JSON.parse(message.toString());
      const topicParts = topic.split('/');
      
      if (topicParts.length >= 3) {
        const deviceId = topicParts[1];
        const messageType = topicParts[2];

        if (messageType === 'location') {
          await this.processLocationUpdate(deviceId, payload);
        } else if (messageType === 'status') {
          await this.processStatusUpdate(deviceId, payload);
        }
      }
    } catch (error) {
      logger.error('Error processing MQTT message:', {
        topic,
        error: error instanceof Error ? error.message : String(error),
        message: message.toString().substring(0, 500)
      });
    }
  }

  private async processLocationUpdate(deviceId: string, payload: any): Promise<void> {
    try {
      // Add device_id to payload if not present
      const locationData = { ...payload, device_id: deviceId };
      
      // Validate location data
      const validatedData = DeviceLocationSchema.parse(locationData);
      
      // Enrich with processing timestamp
      const enrichedEvent = {
        ...validatedData,
        received_at: new Date().toISOString(),
        event_type: 'location_update',
        source: 'mqtt'
      };

      // Send to Kafka
      await this.publishToKafka(KAFKA_RAW_EVENTS_TOPIC, enrichedEvent, deviceId);

      logger.debug('📍 Location update processed:', {
        device_id: deviceId,
        lat: validatedData.latitude,
        lng: validatedData.longitude,
        accuracy: validatedData.accuracy
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Invalid location data format:', {
          device_id: deviceId,
          errors: error.errors,
          payload
        });
      } else {
        logger.error('Error processing location update:', error);
      }
    }
  }

  private async processStatusUpdate(deviceId: string, payload: any): Promise<void> {
    try {
      // Add device_id to payload if not present
      const statusData = { ...payload, device_id: deviceId };
      
      // Validate status data
      const validatedData = DeviceStatusSchema.parse(statusData);
      
      // Enrich with processing timestamp
      const enrichedEvent = {
        ...validatedData,
        received_at: new Date().toISOString(),
        event_type: 'status_update',
        source: 'mqtt'
      };

      // Send to Kafka
      await this.publishToKafka(KAFKA_RAW_EVENTS_TOPIC, enrichedEvent, deviceId);

      logger.debug('📊 Status update processed:', {
        device_id: deviceId,
        status: validatedData.status,
        battery: validatedData.battery_level
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Invalid status data format:', {
          device_id: deviceId,
          errors: error.errors,
          payload
        });
      } else {
        logger.error('Error processing status update:', error);
      }
    }
  }

  private async publishToKafka(topic: string, data: any, key: string): Promise<void> {
    if (!this.kafkaProducer) {
      throw new Error('Kafka producer not initialized');
    }

    try {
      await this.kafkaProducer.send({
        topic,
        messages: [{
          key,
          value: JSON.stringify(data),
          timestamp: Date.now().toString()
        }]
      });
    } catch (error) {
      logger.error('Failed to publish to Kafka:', {
        topic,
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private handleMQTTError(error: Error): void {
    logger.error('MQTT client error:', error);
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
      logger.error('Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      logger.error('Unhandled rejection:', reason instanceof Error ? reason.message : String(reason));
      await this.shutdown();
      process.exit(1);
    });
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('🛑 Shutting down MQTT Ingestion Service...');

    try {
      // Publish offline status
      if (this.mqttClient?.connected) {
        await new Promise<void>((resolve) => {
          this.mqttClient!.publish(
            'services/mqtt-ingestion/status',
            JSON.stringify({ status: 'offline', timestamp: new Date().toISOString() }),
            { qos: 1, retain: true },
            () => resolve()
          );
        });
      }

      // Close MQTT connection
      if (this.mqttClient) {
        await new Promise<void>((resolve) => {
          this.mqttClient!.end(true, {}, () => {
            logger.info('✅ MQTT client disconnected');
            resolve();
          });
        });
      }

      // Close Kafka producer
      if (this.kafkaProducer) {
        await this.kafkaProducer.disconnect();
        logger.info('✅ Kafka producer disconnected');
      }

      logger.info('✅ MQTT Ingestion Service shutdown complete');
      
    } catch (error) {
      logger.error('Error during shutdown:', error instanceof Error ? error.message : String(error));
    } finally {
      process.exit(0);
    }
  }
}

// Start the service
async function main() {
  const service = new MQTTIngestionService();
  
  try {
    await service.start();
  } catch (error) {
    logger.error('Failed to start service:', error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Unhandled error in main:', error);
  process.exit(1);
});
