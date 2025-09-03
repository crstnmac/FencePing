import { Kafka, Producer } from 'kafkajs';
import { KAFKA_TOPICS } from '@geofence/shared';

interface KafkaConfig {
  brokers: string[];
  clientId: string;
}

interface LocationEvent {
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  timestamp: string;
}

class KafkaProducerService {
  private kafka: Kafka;
  private producer: Producer;
  private connected: boolean = false;

  constructor(config: KafkaConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
    });
    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
      console.log('✅ Kafka producer connected');
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
      console.log('🔌 Kafka producer disconnected');
    }
  }

  async publishLocationEvent(event: LocationEvent): Promise<void> {
    if (!this.connected) {
      throw new Error('Kafka producer not connected');
    }

    await this.producer.send({
      topic: KAFKA_TOPICS.RAW_EVENTS,
      messages: [{
        key: event.deviceId,
        value: JSON.stringify({
          deviceId: event.deviceId,
          latitude: event.latitude,
          longitude: event.longitude,
          timestamp: event.timestamp,
          accuracy: event.accuracy,
          altitude: event.altitude,
          metadata: {}
        }),
        timestamp: new Date(event.timestamp).getTime().toString()
      }]
    });

    console.log(`📍 Location event published for device ${event.deviceId}`);
  }

  async publishEventReplay(events: any[]): Promise<void> {
    if (!this.connected) {
      throw new Error('Kafka producer not connected');
    }

    const messages = events.map(event => ({
      key: event.device_id,
      value: JSON.stringify({
        ...event,
        replayed: true,
        replayedAt: new Date().toISOString()
      }),
      timestamp: new Date(event.timestamp).getTime().toString()
    }));

    await this.producer.send({
      topic: KAFKA_TOPICS.AUDIT_LOG,
      messages
    });

    console.log(`🔄 Event replay published: ${events.length} events`);
  }
}

let kafkaProducer: KafkaProducerService | null = null;

export const getKafkaProducer = (): KafkaProducerService => {
  if (!kafkaProducer) {
    const brokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
    const clientId = process.env.KAFKA_CLIENT_ID || 'geofence-api';
    
    kafkaProducer = new KafkaProducerService({ brokers, clientId });
  }
  return kafkaProducer;
};

export const initializeKafka = async (): Promise<void> => {
  const producer = getKafkaProducer();
  await producer.connect();
};

export const shutdownKafka = async (): Promise<void> => {
  if (kafkaProducer) {
    await kafkaProducer.disconnect();
    kafkaProducer = null;
  }
};