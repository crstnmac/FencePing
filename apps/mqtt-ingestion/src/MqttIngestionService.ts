import mqtt, { MqttClient } from 'mqtt';
import { Kafka, Producer } from 'kafkajs';
import { Logger } from 'pino';
import { createHash, createHmac } from 'crypto';
import { z } from 'zod';

interface MqttIngestionConfig {
  mqtt: {
    brokerUrl: string;
    username?: string;
    password?: string;
    clientId?: string;
  };
  kafka: Kafka;
  logger: Logger;
}

const LocationPayloadSchema = z.object({
  v: z.number().default(1),
  ts: z.string(),
  lat: z.number(),
  lon: z.number(),
  speedMps: z.number().optional(),
  accuracyM: z.number().optional(),
  batteryPct: z.number().optional(),
  attrs: z.record(z.any()).optional(),
  sig: z.string()
});

const RawEventSchema = z.object({
  v: z.number().default(1),
  accountId: z.string().uuid(),
  deviceId: z.string().uuid(),
  ts: z.string(),
  lat: z.number(),
  lon: z.number(),
  speedMps: z.number().optional(),
  accuracyM: z.number().optional(),
  batteryPct: z.number().optional(),
  attrs: z.record(z.any()).optional()
});

export class MqttIngestionService {
  private mqttClient: MqttClient | null = null;
  private kafkaProducer: Producer;
  private logger: Logger;
  private config: MqttIngestionConfig;
  private deviceKeyMap = new Map<string, { accountId: string; deviceId: string }>();
  private isRunning = false;

  constructor(config: MqttIngestionConfig) {
    this.config = config;
    this.kafkaProducer = config.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });
    this.logger = config.logger;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Service is already running');
    }

    try {
      this.logger.info('Starting MQTT Ingestion Service...');

      // Connect to Kafka first
      await this.kafkaProducer.connect();
      this.logger.info('✅ Connected to Kafka');

      // Connect to MQTT broker
      await this.connectToMqtt();
      
      this.isRunning = true;
      this.logger.info('🚀 MQTT Ingestion Service started successfully');
    } catch (error) {
      this.logger.error(error, 'Failed to start MQTT Ingestion Service');
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.logger.info('Stopping MQTT Ingestion Service...');

      if (this.mqttClient) {
        await new Promise<void>((resolve) => {
          this.mqttClient!.end(false, {}, () => {
            this.logger.info('🔌 Disconnected from MQTT broker');
            resolve();
          });
        });
        this.mqttClient = null;
      }

      await this.kafkaProducer.disconnect();
      this.logger.info('🔌 Disconnected from Kafka');

      this.isRunning = false;
      this.logger.info('⏹️  MQTT Ingestion Service stopped');
    } catch (error) {
      this.logger.error(error, 'Error stopping MQTT Ingestion Service');
      throw error;
    }
  }

  private async connectToMqtt(): Promise<void> {
    const { mqtt: mqttConfig } = this.config;

    const options = {
      clientId: mqttConfig.clientId || `mqtt-ingestion-${Date.now()}`,
      username: mqttConfig.username,
      password: mqttConfig.password,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      will: {
        topic: 'geofence/status',
        payload: JSON.stringify({
          client: mqttConfig.clientId || `mqtt-ingestion-${Date.now()}`,
          status: 'offline',
          timestamp: new Date().toISOString()
        }),
        qos: 1 as const,
        retain: false
      }
    };

    this.mqttClient = mqtt.connect(mqttConfig.brokerUrl, options);

    return new Promise((resolve, reject) => {
      if (!this.mqttClient) {
        return reject(new Error('MQTT client not initialized'));
      }

      const timeout = setTimeout(() => {
        reject(new Error('MQTT connection timeout'));
      }, 30000);

      this.mqttClient.on('connect', () => {
        clearTimeout(timeout);
        this.logger.info(`✅ Connected to MQTT broker at ${mqttConfig.brokerUrl}`);
        
        // Publish online status
        this.mqttClient!.publish('geofence/status', JSON.stringify({
          client: options.clientId,
          status: 'online',
          timestamp: new Date().toISOString()
        }), { qos: 1 });
        
        this.subscribeToTopics();
        resolve();
      });

      this.mqttClient.on('error', (error) => {
        clearTimeout(timeout);
        this.logger.error(error, 'MQTT connection error');
        reject(error);
      });

      this.mqttClient.on('disconnect', () => {
        this.logger.warn('🔌 MQTT client disconnected');
      });

      this.mqttClient.on('reconnect', () => {
        this.logger.info('🔄 Reconnecting to MQTT broker');
      });

      this.mqttClient.on('offline', () => {
        this.logger.warn('📡 MQTT client offline');
      });

      this.mqttClient.on('message', this.handleMqttMessage.bind(this));
    });
  }

  private async subscribeToTopics(): Promise<void> {
    if (!this.mqttClient) {
      this.logger.error('Cannot subscribe: MQTT client not connected');
      return;
    }

    // Subscribe to geofence location topics: geofence/{accountId}/{deviceKey}
    const topicPattern = 'geofence/+/+';
    
    await new Promise<void>((resolve, reject) => {
      this.mqttClient!.subscribe(topicPattern, { qos: 1 }, (error) => {
        if (error) {
          reject(error);
          return;
        }
        
        this.logger.info({ topic: topicPattern }, '📡 Subscribed to MQTT topic');
        resolve();
      });
    });

    // Also subscribe to WebSocket MQTT topics if needed
    const wsTopicPattern = 'ws/geofence/+/+';
    await new Promise<void>((resolve) => {
      this.mqttClient!.subscribe(wsTopicPattern, { qos: 1 }, (error) => {
        if (error) {
          this.logger.warn({ error, topic: wsTopicPattern }, 'Failed to subscribe to WebSocket topic');
        } else {
          this.logger.info({ topic: wsTopicPattern }, '📡 Subscribed to WebSocket MQTT topic');
        }
        resolve(); // Don't fail if WebSocket topics aren't available
      });
    });
  }

  private async handleMqttMessage(topic: string, payload: Buffer): Promise<void> {
    const startTime = Date.now();
    const logger = this.logger.child({ topic });

    try {
      // Parse topic to extract accountId and deviceKey
      const topicMatch = topic.match(/(?:ws\/)?geofence\/([^\/]+)\/([^\/]+)/);
      if (!topicMatch) {
        logger.warn('Invalid topic format');
        return;
      }

      const [, accountId, deviceKey] = topicMatch;
      
      // Parse payload
      const payloadStr = payload.toString();
      let locationData: z.infer<typeof LocationPayloadSchema>;
      
      try {
        locationData = LocationPayloadSchema.parse(JSON.parse(payloadStr));
      } catch (parseError) {
        logger.warn({ parseError, payload: payloadStr }, 'Invalid payload format');
        await this.publishToDLQ('raw_events', 'Invalid payload format', {
          topic,
          payload: payloadStr,
          accountId,
          deviceKey
        });
        return;
      }

      // Resolve device info and verify signature
      const deviceInfo = await this.resolveDeviceInfo(accountId, deviceKey);
      if (!deviceInfo) {
        logger.warn({ accountId, deviceKey }, 'Device not found or unauthorized');
        await this.publishToDLQ('raw_events', 'Device not found or unauthorized', {
          topic,
          payload: payloadStr,
          accountId,
          deviceKey
        });
        return;
      }

      if (!this.verifySignature(locationData, deviceKey)) {
        logger.warn({ accountId, deviceKey }, 'Invalid signature');
        await this.publishToDLQ('raw_events', 'Invalid signature', {
          topic,
          payload: payloadStr,
          accountId,
          deviceKey
        });
        return;
      }

      // Create raw event
      const rawEvent = RawEventSchema.parse({
        v: locationData.v,
        accountId: deviceInfo.accountId,
        deviceId: deviceInfo.deviceId,
        ts: locationData.ts,
        lat: locationData.lat,
        lon: locationData.lon,
        speedMps: locationData.speedMps,
        accuracyM: locationData.accuracyM,
        batteryPct: locationData.batteryPct,
        attrs: locationData.attrs
      });

      // Publish to Kafka
      await this.kafkaProducer.send({
        topic: 'raw_events',
        messages: [{
          key: deviceInfo.deviceId,
          value: JSON.stringify(rawEvent),
          timestamp: new Date(locationData.ts).getTime().toString()
        }]
      });

      const processingTime = Date.now() - startTime;
      logger.info({
        accountId: deviceInfo.accountId,
        deviceId: deviceInfo.deviceId,
        processingTime
      }, '📍 Location event processed successfully');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error({ error, processingTime }, 'Failed to process location event');
      
      // Publish to DLQ
      await this.publishToDLQ('raw_events', error instanceof Error ? error.message : 'Unknown error', {
        topic,
        payload: payload.toString()
      });
    }
  }

  private async resolveDeviceInfo(accountId: string, deviceKey: string): Promise<{ accountId: string; deviceId: string } | null> {
    // Check cache first
    const cacheKey = `${accountId}:${deviceKey}`;
    if (this.deviceKeyMap.has(cacheKey)) {
      return this.deviceKeyMap.get(cacheKey)!;
    }

    // In a real implementation, this would query the database
    // For now, we'll create a simple hash-based device ID
    // This should be replaced with actual database lookup
    const deviceId = createHash('sha256')
      .update(`${accountId}:${deviceKey}`)
      .digest('hex')
      .substring(0, 32);

    // Format as UUID (this is a simplified approach)
    const uuid = `${deviceId.substring(0, 8)}-${deviceId.substring(8, 12)}-${deviceId.substring(12, 16)}-${deviceId.substring(16, 20)}-${deviceId.substring(20, 32)}`;

    const deviceInfo = { accountId, deviceId: uuid };
    
    // Cache for future lookups
    this.deviceKeyMap.set(cacheKey, deviceInfo);
    
    return deviceInfo;
  }

  private verifySignature(payload: z.infer<typeof LocationPayloadSchema>, deviceKey: string): boolean {
    try {
      // Create payload without signature for verification
      const { sig, ...payloadWithoutSig } = payload;
      
      // Sort keys for consistent hashing
      const sortedPayload = JSON.stringify(payloadWithoutSig, Object.keys(payloadWithoutSig).sort());
      
      // Generate HMAC-SHA256 signature
      const expectedSignature = createHmac('sha256', deviceKey)
        .update(sortedPayload)
        .digest('hex');
      
      return sig === expectedSignature;
    } catch (error) {
      this.logger.warn({ error }, 'Signature verification failed');
      return false;
    }
  }

  private async publishToDLQ(originalTopic: string, error: string, data: any): Promise<void> {
    try {
      const dlqMessage = {
        v: 1,
        topic: originalTopic,
        error,
        data,
        timestamp: new Date().toISOString()
      };

      await this.kafkaProducer.send({
        topic: 'dlq',
        messages: [{
          key: `dlq-${Date.now()}`,
          value: JSON.stringify(dlqMessage)
        }]
      });

      this.logger.info({ originalTopic, error }, 'Message sent to DLQ');
    } catch (dlqError) {
      this.logger.error({ dlqError, originalTopic, error }, 'Failed to send message to DLQ');
    }
  }

  // Health check method
  isHealthy(): boolean {
    return this.isRunning && 
           this.mqttClient?.connected === true && 
           this.kafkaProducer !== null;
  }

  // Metrics method
  getMetrics() {
    return {
      isRunning: this.isRunning,
      mqttConnected: this.mqttClient?.connected || false,
      kafkaConnected: this.kafkaProducer !== null,
      cachedDevices: this.deviceKeyMap.size
    };
  }
}