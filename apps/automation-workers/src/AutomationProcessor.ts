import { Consumer, Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { Logger } from 'pino';
import { createHash } from 'crypto';
import { Queue } from 'bullmq';

interface RawLocationEvent {
  v: number;
  accountId: string;
  deviceId: string;
  ts: string;
  lat: number;
  lon: number;
  speedMps?: number;
  accuracyM?: number;
  batteryPct?: number;
  attrs?: Record<string, any>;
}

interface GeofenceEventData {
  accountId: string;
  deviceId: string;
  geofenceId: string;
  type: 'enter' | 'exit' | 'dwell';
  timestamp: string;
  dwellSeconds?: number;
  location: [number, number]; // [lng, lat]
}

export class AutomationProcessor {
  private consumer: Consumer;
  private dbPool: Pool;
  private logger: Logger;
  private queue: Queue;
  private isRunning = false;

  constructor(kafka: Kafka, dbPool: Pool, logger: Logger, redisConfig: any) {
    this.dbPool = dbPool;
    this.logger = logger;
    this.queue = new Queue('webhook-delivery', { connection: redisConfig });

    this.consumer = kafka.consumer({
      groupId: 'automation-processor',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Automation processor is already running');
    }

    try {
      await this.consumer.connect();
      this.logger.info('Connected to Kafka consumer');

      await this.consumer.subscribe({
        topics: ['gf_events'],
        fromBeginning: false
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message, heartbeat }) => {
          try {
            if (topic === 'raw_events') {
              await this.processLocationEvent(message.value?.toString() || '');
            } else if (topic === 'gf_events') {
              await this.processGeofenceEvent(JSON.parse(message.value?.toString() || '{}'));
            }
            await heartbeat();
          } catch (error) {
            this.logger.error({
              error: this.serializeError(error),
              topic,
              partition
            }, 'Failed to process message');

            // For validation errors (missing accounts/devices), don't crash the consumer
            if (error instanceof Error && error.message && error.message.includes('does not exist')) {
              this.logger.warn('Continuing message processing after validation error');
              return; // Continue processing other messages
            }

            // For other errors, we may want to crash and restart
            throw error;
          }
        },
      });

      this.isRunning = true;
      this.logger.info('🚀 Automation processor started');

    } catch (error) {
      this.logger.error({ error }, 'Failed to start automation processor');
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      this.logger.info('Stopping automation processor...');

      await this.consumer.disconnect();

      this.isRunning = false;
      this.logger.info('Automation processor stopped');
    } catch (error) {
      this.logger.error({ error }, 'Error stopping automation processor');
      throw error;
    }
  }

  private async processLocationEvent(messageValue: string): Promise<void> {
    try {
      const locationEvent: RawLocationEvent = JSON.parse(messageValue);

      // Store location in database
      try {
        await this.storeLocationEvent(locationEvent);
      } catch (validationError) {
        // Don't throw for validation errors - just log and skip
        if (validationError instanceof Error && validationError.message.includes('does not exist')) {
          this.logger.warn({ locationEvent }, 'Skipping location event due to missing account/device');
          return; // Skip processing this event
        }
        throw validationError; // Re-throw other errors
      }

      // Check for geofence events
      const geofenceEvents = await this.checkGeofenceEvents(locationEvent);

      // Process each geofence event
      for (const geofenceEvent of geofenceEvents) {
        try {
          await this.processGeofenceEvent(geofenceEvent);
        } catch (geofenceError) {
          this.logger.warn({
            error: this.serializeError(geofenceError),
            geofenceEvent
          }, 'Failed to process individual geofence event, continuing with others');
          // Continue processing other geofence events
        }
      }

    } catch (error) {
      this.logger.error({
        error: this.serializeError(error),
        message: messageValue
      }, 'Failed to process location event');
      throw error;
    }
  }

  private async storeLocationEvent(event: RawLocationEvent): Promise<string> {
    // First validate that account and device exist
    const validationResult = await this.dbPool.query(`
      SELECT d.id as device_id, d.account_id, a.id as account_id_exists
      FROM devices d
      INNER JOIN accounts a ON d.account_id = a.id
      WHERE d.id = $1 AND a.id = $2
    `, [event.deviceId, event.accountId]);

    if (validationResult.rows.length === 0) {
      this.logger.warn({
        accountId: event.accountId,
        deviceId: event.deviceId
      }, 'Skipping location event - account or device does not exist');
      throw new Error(`Account ${event.accountId} or device ${event.deviceId} does not exist`);
    }

    const result = await this.dbPool.query(`
      INSERT INTO location_events (
        account_id, device_id, ts, loc, speed_mps, accuracy_m, battery_pct, payload
      ) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8, $9)
      RETURNING id
    `, [
      event.accountId,
      event.deviceId,
      event.ts,
      event.lon,
      event.lat,
      event.speedMps || 0,
      event.accuracyM || 10,
      event.batteryPct || 100,
      JSON.stringify(event.attrs || {})
    ]);

    // Update device status
    await this.dbPool.query(`
      UPDATE devices 
      SET status = 'online', last_heartbeat = NOW()
      WHERE id = $1
    `, [event.deviceId]);

    return result.rows[0].id;
  }

  private async checkGeofenceEvents(event: RawLocationEvent): Promise<GeofenceEventData[]> {
    const events: GeofenceEventData[] = [];

    try {
      // Check which geofences the device is currently inside
      const currentGeofences = await this.dbPool.query(`
        SELECT g.id, g.name, g.type
        FROM geofences g
        WHERE g.account_id = $1
          AND g.active = true
          AND ST_Contains(g.geom, ST_SetSRID(ST_MakePoint($2, $3), 4326))
      `, [event.accountId, event.lon, event.lat]);

      // Get previous location state for this device
      const previousState = await this.getDevicePreviousGeofenceState(event.deviceId);

      const currentGeofenceIds = new Set(currentGeofences.rows.map(g => g.id));
      const previousGeofenceIds = new Set(previousState.map(g => g.geofence_id));

      // Detect ENTER events (in current but not in previous)
      for (const geofence of currentGeofences.rows) {
        if (!previousGeofenceIds.has(geofence.id)) {
          events.push({
            accountId: event.accountId,
            deviceId: event.deviceId,
            geofenceId: geofence.id,
            type: 'enter',
            timestamp: event.ts,
            location: [event.lon, event.lat],
            dwellSeconds: 0
          });
        }
      }

      // Detect EXIT events (in previous but not in current)
      for (const prevGeofence of previousState) {
        if (!currentGeofenceIds.has(prevGeofence.geofence_id)) {
          events.push({
            accountId: event.accountId,
            deviceId: event.deviceId,
            geofenceId: prevGeofence.geofence_id,
            type: 'exit',
            timestamp: event.ts,
            location: [event.lon, event.lat],
            dwellSeconds: 0
          });
        }
      }

      // Check for DWELL events (been in geofence for specified time)
      const dwellEvents = await this.checkDwellEvents(event, currentGeofenceIds);
      events.push(...dwellEvents);

    } catch (error) {
      this.logger.error({ error, event }, 'Failed to check geofence events');
    }

    return events;
  }

  private async getDevicePreviousGeofenceState(deviceId: string): Promise<Array<{ geofence_id: string; entered_at: string }>> {
    // Get the most recent ENTER events without corresponding EXIT events
    const result = await this.dbPool.query(`
      WITH latest_events AS (
        SELECT 
          geofence_id,
          type,
          ts,
          ROW_NUMBER() OVER (PARTITION BY geofence_id ORDER BY ts DESC) as rn
        FROM geofence_events 
        WHERE device_id = $1
          AND ts > NOW() - INTERVAL '24 hours'
      )
      SELECT DISTINCT geofence_id, ts as entered_at
      FROM latest_events
      WHERE rn = 1 AND type = 'enter'
        AND NOT EXISTS (
          SELECT 1 FROM latest_events le2 
          WHERE le2.geofence_id = latest_events.geofence_id 
            AND le2.type = 'exit' 
            AND le2.ts > latest_events.ts
        )
    `, [deviceId]);

    return result.rows;
  }

  private async checkDwellEvents(event: RawLocationEvent, currentGeofenceIds: Set<string>): Promise<GeofenceEventData[]> {
    const dwellEvents: GeofenceEventData[] = [];

    for (const geofenceId of currentGeofenceIds) {
      // Check if there are automation rules that require dwell time for this geofence
      const dwellRules = await this.dbPool.query(`
        SELECT ar.min_dwell_seconds, ar.id
        FROM automation_rules ar
        WHERE ar.geofence_id = $1
          AND ar.account_id = $2
          AND ar.enabled = true
          AND ar.min_dwell_seconds > 0
          AND 'dwell' = ANY(ar.on_events)
      `, [geofenceId, event.accountId]);

      for (const rule of dwellRules.rows) {
        // Check if device has been in geofence long enough
        const dwellCheck = await this.dbPool.query(`
          SELECT ts as enter_time
          FROM geofence_events
          WHERE device_id = $1 
            AND geofence_id = $2 
            AND type = 'enter'
            AND ts <= $3
            AND NOT EXISTS (
              SELECT 1 FROM geofence_events ge2
              WHERE ge2.device_id = $1 
                AND ge2.geofence_id = $2
                AND ge2.type = 'exit' 
                AND ge2.ts > geofence_events.ts
                AND ge2.ts <= $3
            )
          ORDER BY ts DESC
          LIMIT 1
        `, [event.deviceId, geofenceId, event.ts]);

        if (dwellCheck.rows.length > 0) {
          const enterTime = new Date(dwellCheck.rows[0].enter_time);
          const currentTime = new Date(event.ts);
          const dwellSeconds = (currentTime.getTime() - enterTime.getTime()) / 1000;

          if (dwellSeconds >= rule.min_dwell_seconds) {
            // Check if we haven't already sent a dwell event for this session
            const existingDwell = await this.dbPool.query(`
              SELECT id FROM geofence_events
              WHERE device_id = $1 
                AND geofence_id = $2 
                AND type = 'dwell'
                AND ts > $3
            `, [event.deviceId, geofenceId, dwellCheck.rows[0].enter_time]);

            if (existingDwell.rows.length === 0) {
              dwellEvents.push({
                accountId: event.accountId,
                deviceId: event.deviceId,
                geofenceId: geofenceId,
                type: 'dwell',
                timestamp: event.ts,
                dwellSeconds: Math.round(dwellSeconds),
                location: [event.lon, event.lat]
              });
            }
          }
        }
      }
    }

    return dwellEvents;
  }

  private async processGeofenceEvent(geofenceEventData: any): Promise<void> {
    const geofenceEvent: GeofenceEventData = {
      accountId: geofenceEventData.accountId,
      deviceId: geofenceEventData.deviceId,
      geofenceId: geofenceEventData.geofenceId,
      type: geofenceEventData.type,
      timestamp: geofenceEventData.ts,
      dwellSeconds: geofenceEventData.dwellSeconds,
      location: geofenceEventData.location || [0, 0]
    };
    try {
      this.logger.debug({ geofenceEvent }, 'Processing geofence event');

      // First validate that account, device, and geofence exist
      const validationResult = await this.dbPool.query(`
        SELECT d.id as device_id, g.id as geofence_id, a.id as account_id
        FROM devices d
        INNER JOIN accounts a ON d.account_id = a.id
        INNER JOIN geofences g ON g.account_id = a.id
        WHERE d.id = $1 AND a.id = $2 AND g.id = $3
      `, [geofenceEvent.deviceId, geofenceEvent.accountId, geofenceEvent.geofenceId]);

      if (validationResult.rows.length === 0) {
        this.logger.warn({
          accountId: geofenceEvent.accountId,
          deviceId: geofenceEvent.deviceId,
          geofenceId: geofenceEvent.geofenceId
        }, 'Skipping geofence event - account, device, or geofence does not exist');
        return; // Skip processing this event
      }

      // Store geofence event
      const eventHash = this.generateEventHash(geofenceEvent);
      this.logger.debug({ eventHash }, 'Generated event hash');

      const geventResult = await this.dbPool.query(`
        INSERT INTO geofence_events (
          account_id, device_id, geofence_id, type, ts, dwell_seconds, event_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (account_id, event_hash) DO NOTHING
        RETURNING id
      `, [
        geofenceEvent.accountId,
        geofenceEvent.deviceId,
        geofenceEvent.geofenceId,
        geofenceEvent.type,
        geofenceEvent.timestamp,
        geofenceEvent.dwellSeconds,
        eventHash
      ]);

      this.logger.debug({ insertedRows: geventResult.rows.length }, 'Inserted geofence event');

      if (geventResult.rows.length === 0) {
        this.logger.debug({ eventHash }, 'Duplicate geofence event, skipping');
        return;
      }

      const geventId = geventResult.rows[0].id;

      // Find matching automation rules
      const automationRules = await this.dbPool.query(`
        SELECT ar.id as rule_id, ar.automation_id, ar.device_id, ar.device_filter
        FROM automation_rules ar
        JOIN automations a ON ar.automation_id = a.id
        WHERE ar.geofence_id = $1
          AND ar.account_id = $2
          AND ar.enabled = true
          AND a.enabled = true
          AND $3 = ANY(ar.on_events)
          AND (ar.device_id IS NULL OR ar.device_id = $4)
          AND (ar.min_dwell_seconds <= $5)
      `, [
        geofenceEvent.geofenceId,
        geofenceEvent.accountId,
        geofenceEvent.type,
        geofenceEvent.deviceId,
        geofenceEvent.dwellSeconds || 0
      ]);

      // Process each matching rule
      for (const rule of automationRules.rows) {
        // Check device filter if specified
        if (rule.device_filter && Object.keys(rule.device_filter).length > 0) {
          const deviceMatches = await this.checkDeviceFilter(geofenceEvent.deviceId, rule.device_filter);
          if (!deviceMatches) continue;
        }

        // Create delivery record
        const deliveryResult = await this.dbPool.query(`
          INSERT INTO deliveries (
            account_id, automation_id, rule_id, gevent_id, status, attempt, next_attempt_at
          ) VALUES ($1, $2, $3, $4, 'pending', 0, NOW())
          RETURNING id
        `, [
          geofenceEvent.accountId,
          rule.automation_id,
          rule.rule_id,
          geventId
        ]);

        const deliveryId = deliveryResult.rows[0].id;

        try {
          await this.queue.add('delivery', {
            deliveryId,
            automationId: rule.automation_id,
            ruleId: rule.rule_id,
            geventId: geventId,
            accountId: geofenceEvent.accountId
          });

          this.logger.info({
            deliveryId,
            automationId: rule.automation_id,
            geofenceId: geofenceEvent.geofenceId,
            eventType: geofenceEvent.type
          }, 'Delivery queued successfully');

        } catch (error) {
          this.logger.error({
            error: this.serializeError(error),
            deliveryId
          }, 'Failed to queue delivery');
          await this.updateDeliveryStatus(deliveryId, 'failed', error instanceof Error ? error.message : 'Failed to queue delivery');
        }
      }

    } catch (error) {
      this.logger.error({
        error: this.serializeError(error),
        geofenceEvent
      }, 'Failed to process geofence event');
      throw error;
    }
  }

  private generateEventHash(event: GeofenceEventData): string {
    const hashString = `${event.deviceId}:${event.geofenceId}:${event.type}:${event.timestamp}`;
    return createHash('sha256').update(hashString).digest('hex').substring(0, 16);
  }

  private serializeError(error: unknown): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        detail: (error as any).detail
      };
    }
    if (typeof error === 'object' && error !== null) {
      return {
        name: (error as any).name,
        message: (error as any).message,
        stack: (error as any).stack,
        code: (error as any).code,
        detail: (error as any).detail,
        toString: error.toString?.()
      };
    }
    return { value: error, type: typeof error };
  }

  private async checkDeviceFilter(deviceId: string, filter: Record<string, any>): Promise<boolean> {
    // This would check device metadata against the filter
    // For now, return true (no filtering)
    return true;
  }

  // getEnrichedGeofenceEvent and buildWebhookPayload removed as they are no longer needed for queuing

  private async updateDeliveryStatus(
    deliveryId: string,
    status: 'success' | 'failed' | 'disabled',
    error?: string,
    responseData?: any
  ): Promise<void> {
    try {
      const errorValue = status === 'failed' ? error || 'Unknown error' : null;
      await this.dbPool.query(`
        UPDATE deliveries
        SET status = $1,
            last_error = $2,
            updated_at = NOW(),
            response_data = $3
        WHERE id = $4
      `, [status, errorValue, responseData ? JSON.stringify(responseData) : null, deliveryId]);
    } catch (dbError) {
      this.logger.error({ dbError, deliveryId }, 'Failed to update delivery status');
    }
  }

  isHealthy(): boolean {
    return this.isRunning;
  }

  getMetrics() {
    return {
      isRunning: this.isRunning,
      consumerConnected: this.consumer !== null,
    };
  }
}