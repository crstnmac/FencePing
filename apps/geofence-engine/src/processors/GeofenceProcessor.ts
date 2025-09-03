import { Kafka, Consumer, Producer } from 'kafkajs';
import { Client } from 'pg';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { z } from 'zod';
import { createHash } from 'crypto';

// Schema for raw events from MQTT ingestion
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

interface GeofenceProcessorConfig {
  kafka: Kafka;
  pgClient: Client;
  redis: Redis;
  logger: Logger;
}

interface DwellState {
  geofenceId: string;
  deviceId: string;
  accountId: string;
  entryTime: number;
  lastSeen: number;
  notifiedIntervals: number[]; // Track which intervals have been notified
}

export class GeofenceProcessor {
  private consumer: Consumer;
  private producer: Producer;
  private pgClient: Client;
  private redis: Redis;
  private logger: Logger;

  constructor(config: GeofenceProcessorConfig) {
    this.consumer = config.kafka.consumer({ groupId: 'geofence-processor' });
    this.producer = config.kafka.producer();
    this.pgClient = config.pgClient;
    this.redis = config.redis;
    this.logger = config.logger;
  }

  async start() {
    await this.consumer.connect();
    await this.producer.connect();

    await this.consumer.subscribe({ 
      topics: ['raw_events'],
      fromBeginning: false
    });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          if (!message.value) return;

          const rawData = JSON.parse(message.value.toString());
          const event = RawEventSchema.parse(rawData);
          await this.processLocationEvent(event);
        } catch (error) {
          this.logger.error(error, 'Error processing message');
          
          // Send to DLQ if parsing fails
          await this.sendToDLQ('raw_events', message.value?.toString() || '', error);
        }
      }
    });

    this.logger.info('✅ GeofenceProcessor started');
  }

  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
    this.logger.info('⏹️  GeofenceProcessor stopped');
  }

  async processLocationEvent(event: z.infer<typeof RawEventSchema>) {
    const { accountId, deviceId, lat, lon, ts, speedMps, accuracyM, batteryPct, attrs } = event;

    try {
      // Store location event in database
      await this.storeLocationEvent(event);

      // Get active geofences for this account
      const geofencesQuery = `
        SELECT 
          id,
          name,
          type,
          geom,
          radius_m,
          CASE 
            WHEN type = 'circle' THEN ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, radius_m)
            WHEN type = 'polygon' THEN ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
          END as is_inside
        FROM geofences 
        WHERE account_id = $3 AND active = true
        AND ST_DWithin(
          geom,
          ST_SetSRID(ST_MakePoint($1, $2), 4326),
          0.01 -- ~1km buffer for performance
        )
      `;

      const geofencesResult = await this.pgClient.query(geofencesQuery, [lon, lat, accountId]);
      const geofences = geofencesResult.rows;

      // Get device's previous state from Redis
      const deviceStateKey = `device_state:${accountId}:${deviceId}`;
      const previousStateJson = await this.redis.get(deviceStateKey);
      const previousState = previousStateJson ? JSON.parse(previousStateJson) : { geofences: [], timestamp: null };

      const currentGeofenceIds = geofences
        .filter((g: any) => g.is_inside)
        .map((g: any) => g.id);

      // Detect transitions with hysteresis (20 second stability requirement)
      const now = new Date(ts).getTime();
      const timeSinceLastUpdate = previousState.timestamp ? now - new Date(previousState.timestamp).getTime() : 0;
      const isStable = timeSinceLastUpdate >= 20000; // 20 seconds

      if (isStable) {
        // Detect enter/exit events
        const enteredGeofences = currentGeofenceIds.filter(id => !previousState.geofences.includes(id));
        const exitedGeofences = previousState.geofences.filter((id: string) => !currentGeofenceIds.includes(id));

        // Process enter events
        for (const geofenceId of enteredGeofences) {
          await this.handleGeofenceEvent(accountId, deviceId, geofenceId, 'enter', ts, { lat, lon });
        }

        // Process exit events
        for (const geofenceId of exitedGeofences) {
          await this.handleGeofenceEvent(accountId, deviceId, geofenceId, 'exit', ts, { lat, lon });
        }
      }

      // Store current state
      await this.redis.setex(deviceStateKey, 3600, JSON.stringify({
        geofences: currentGeofenceIds,
        timestamp: ts
      }));

      // Process dwell detection for current geofences
      await this.processDwellDetection(accountId, deviceId, currentGeofenceIds, ts, { lat, lon });

      this.logger.debug(`Processed location for device ${deviceId}: ${currentGeofenceIds.length} active geofences`);

    } catch (error) {
      this.logger.error(error, `Error processing location for device ${deviceId}`);
      await this.sendToDLQ('gf_events', JSON.stringify(event), error);
    }
  }

  private async storeLocationEvent(event: z.infer<typeof RawEventSchema>) {
    const query = `
      INSERT INTO location_events (account_id, device_id, ts, loc, speed_mps, accuracy_m, battery_pct, payload)
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8, $9)
    `;

    await this.pgClient.query(query, [
      event.accountId,
      event.deviceId, 
      event.ts,
      event.lon,
      event.lat,
      event.speedMps,
      event.accuracyM,
      event.batteryPct,
      JSON.stringify(event.attrs || {})
    ]);
  }

  private async handleGeofenceEvent(
    accountId: string,
    deviceId: string,
    geofenceId: string,
    type: 'enter' | 'exit' | 'dwell',
    timestamp: string,
    location: { lat: number; lon: number },
    dwellSeconds?: number
  ) {
    // Create unique hash for deduplication
    const eventHash = createHash('sha256')
      .update(`${accountId}:${deviceId}:${geofenceId}:${type}:${timestamp}`)
      .digest('hex');

    try {
      // Store geofence event
      const insertQuery = `
        INSERT INTO geofence_events (account_id, device_id, geofence_id, type, ts, dwell_seconds, event_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (account_id, event_hash) DO NOTHING
        RETURNING id
      `;

      const result = await this.pgClient.query(insertQuery, [
        accountId,
        deviceId,
        geofenceId,
        type,
        timestamp,
        dwellSeconds,
        eventHash
      ]);

      // Only publish if event was actually inserted (not duplicate)
      if (result.rows.length > 0) {
        const geofenceEvent = {
          v: 1,
          accountId,
          deviceId,
          geofenceId,
          type,
          ts: timestamp,
          dwellSeconds
        };

        await this.producer.send({
          topic: 'gf_events',
          messages: [{
            key: deviceId,
            value: JSON.stringify(geofenceEvent)
          }]
        });

        this.logger.info(`🎯 ${type.toUpperCase()} event: Device ${deviceId} ${type}ed geofence ${geofenceId}`);
      }

    } catch (error) {
      this.logger.error(error, `Failed to handle geofence event: ${type}`);
    }
  }

  private async processDwellDetection(
    accountId: string,
    deviceId: string,
    currentGeofences: string[],
    timestamp: string,
    location: { lat: number; lon: number }
  ) {
    const now = new Date(timestamp).getTime();
    const dwellStateKey = `dwell:${accountId}:${deviceId}`;
    
    try {
      // Get current dwell states
      const dwellStatesJson = await this.redis.get(dwellStateKey);
      const dwellStates: DwellState[] = dwellStatesJson ? JSON.parse(dwellStatesJson) : [];
      
      // Update dwell states for current geofences
      const updatedStates: DwellState[] = [];
      
      for (const geofenceId of currentGeofences) {
        const existingState = dwellStates.find(s => s.geofenceId === geofenceId);
        
        if (existingState) {
          // Update existing dwell state
          updatedStates.push({
            ...existingState,
            lastSeen: now
          });
        } else {
          // New geofence entry - start dwell tracking
          updatedStates.push({
            geofenceId,
            deviceId,
            accountId,
            entryTime: now,
            lastSeen: now,
            notifiedIntervals: []
          });
        }
      }
      
      // Check for dwell threshold violations and emit dwell events (every 5 minutes)
      for (const state of updatedStates) {
        const dwellMinutes = Math.floor((now - state.entryTime) / (1000 * 60));
        const intervals = [5, 10, 15, 30, 60, 120]; // 5min, 10min, 15min, 30min, 1hr, 2hr
        
        for (const interval of intervals) {
          if (dwellMinutes >= interval && !state.notifiedIntervals.includes(interval)) {
            state.notifiedIntervals.push(interval);
            await this.handleGeofenceEvent(
              accountId, 
              deviceId, 
              state.geofenceId, 
              'dwell', 
              timestamp, 
              location, 
              dwellMinutes * 60 // Convert to seconds
            );
          }
        }
      }
      
      // Store updated dwell states (expire after 24 hours)
      if (updatedStates.length > 0) {
        await this.redis.setex(dwellStateKey, 86400, JSON.stringify(updatedStates));
      } else {
        await this.redis.del(dwellStateKey);
      }
      
    } catch (error) {
      this.logger.error(error, `Error processing dwell detection for device ${deviceId}`);
    }
  }

  private async sendToDLQ(originalTopic: string, data: string, error: any) {
    try {
      const dlqMessage = {
        v: 1,
        topic: originalTopic,
        error: error instanceof Error ? error.message : String(error),
        data,
        timestamp: new Date().toISOString()
      };

      await this.producer.send({
        topic: 'dlq',
        messages: [{
          key: `dlq-${Date.now()}`,
          value: JSON.stringify(dlqMessage)
        }]
      });

      this.logger.info({ originalTopic, error: dlqMessage.error }, 'Message sent to DLQ');
    } catch (dlqError) {
      this.logger.error({ dlqError, originalTopic, error }, 'Failed to send message to DLQ');
    }
  }

  // Health check method
  isHealthy(): boolean {
    return !!(this.consumer && this.producer);
  }

  // Metrics method
  getMetrics() {
    return {
      isRunning: true,
      consumerConnected: !!this.consumer,
      producerConnected: !!this.producer
    };
  }

}
