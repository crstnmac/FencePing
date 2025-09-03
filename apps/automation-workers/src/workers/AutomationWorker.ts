import { Kafka, Consumer } from 'kafkajs';
import { Client } from 'pg';
import Redis from 'ioredis';
import { Queue } from 'bull';
import { Logger } from 'pino';
import { KAFKA_TOPICS, AUTOMATION_STATUS } from '@geofence/shared';
import { NotionIntegration } from '../integrations/NotionIntegration.js';
import { GoogleSheetsIntegration } from '../integrations/GoogleSheetsIntegration.js';
import { SlackIntegration } from '../integrations/SlackIntegration.js';
import { WhatsAppIntegration } from '../integrations/WhatsAppIntegration.js';
import { WebhookIntegration } from '../integrations/WebhookIntegration.js';

interface WorkerConfig {
  kafka: Kafka;
  pgClient: Client;
  redis: Redis;
  webhookQueue: Queue;
  logger: Logger;
}

interface GeofenceEvent {
  type: 'enter' | 'exit' | 'dwell';
  deviceId: string;
  geofenceId: string;
  location: { latitude: number; longitude: number };
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface Integration {
  execute(payload: Record<string, unknown>, config: Record<string, unknown>, credentials: Record<string, unknown>): Promise<any>;
}

export class AutomationWorker {
  private consumer: Consumer;
  private pgClient: Client;
  private webhookQueue: Queue;
  private logger: Logger;
  private integrations: Map<string, Integration>;

  constructor(config: WorkerConfig) {
    this.consumer = config.kafka.consumer({ groupId: 'automation-workers' });
    this.pgClient = config.pgClient;
    this.webhookQueue = config.webhookQueue;
    this.logger = config.logger;

    // Initialize integrations
    this.integrations = new Map<string, Integration>([
      ['notion', new NotionIntegration(config.logger)],
      ['google_sheets', new GoogleSheetsIntegration(config.logger)],
      ['slack', new SlackIntegration(config.logger)],
      ['whatsapp', new WhatsAppIntegration(config.logger)],
      ['webhook', new WebhookIntegration(config.logger)]
    ]);
  }

  async start() {
    await this.consumer.connect();

    await this.consumer.subscribe({ 
      topics: [KAFKA_TOPICS.GEOFENCE_EVENTS],
      fromBeginning: false
    });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          if (!message.value) return;

          const event: GeofenceEvent = JSON.parse(message.value.toString());
          await this.processGeofenceEvent(event);
        } catch (error) {
          this.logger.error(error, 'Error processing geofence event');
        }
      }
    });

    // Set up webhook queue processor with concurrency
    this.webhookQueue.process('webhook', 3, async (job) => {
      return await this.executeWebhook(job.data);
    });

    // Handle failed jobs for DLQ
    this.webhookQueue.on('failed', async (job, error) => {
      this.logger.error(`💥 Webhook job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`);
      
      // Move to dead letter queue after max attempts
      if (job.attemptsMade >= (job.opts?.attempts || 3)) {
        await this.handleDeadLetterQueue(job.data, error);
      }
    });

    this.logger.info('✅ AutomationWorker started');
  }

  async stop() {
    await this.consumer.disconnect();
    this.logger.info('⏹️  AutomationWorker stopped');
  }

  private async processGeofenceEvent(event: GeofenceEvent) {
    const { deviceId, geofenceId, type } = event;

    try {
      // Find matching automation rules
      const rulesQuery = `
        SELECT 
          ar.*,
          i.type as integration_type,
          i.config as integration_config,
          i.credentials as integration_credentials,
          d.name as device_name,
          g.name as geofence_name
        FROM automation_rules ar
        JOIN integrations i ON ar.integration_id = i.id
        JOIN devices d ON ar.device_id = d.id OR ar.device_id IS NULL
        JOIN geofences g ON ar.geofence_id = g.id
        WHERE ar.geofence_id = $1
        AND ar.trigger_type = $2
        AND ar.is_active = true
        AND i.is_active = true
        AND (ar.device_id IS NULL OR ar.device_id = (SELECT id FROM devices WHERE device_token = $3))
      `;

      const rulesResult = await this.pgClient.query(rulesQuery, [geofenceId, type, deviceId]);
      const rules = rulesResult.rows;

      this.logger.info(`📋 Found ${rules.length} automation rules for ${type} event`);

      // Execute each matching rule
      for (const rule of rules) {
        await this.executeAutomationRule(rule, event);
      }

    } catch (error) {
      this.logger.error(error, `Error processing geofence event for device ${deviceId}`);
    }
  }

  private async executeAutomationRule(rule: {
    id: string;
    name: string;
    integration_type: string;
    integration_config: Record<string, unknown>;
    integration_credentials: Record<string, unknown>;
    device_name?: string;
    geofence_name: string;
    action_config: Record<string, unknown>;
  }, event: GeofenceEvent) {
    try {
      // Create execution record
      const executionQuery = `
        INSERT INTO automation_executions (automation_rule_id, event_id, status)
        VALUES ($1, (SELECT id FROM events WHERE device_id = (SELECT id FROM devices WHERE device_token = $2) AND geofence_id = $3 AND event_type = $4 ORDER BY timestamp DESC LIMIT 1), 'pending')
        RETURNING id
      `;

      const executionResult = await this.pgClient.query(executionQuery, [
        rule.id,
        event.deviceId,
        event.geofenceId,
        `geofence_${event.type}`
      ]);

      const executionId = executionResult.rows[0]?.id;

      // Prepare webhook payload
      const payload = {
        event,
        device: {
          id: event.deviceId,
          name: rule.device_name || 'Unknown Device'
        },
        geofence: {
          id: event.geofenceId,
          name: rule.geofence_name
        },
        rule: {
          id: rule.id,
          name: rule.name,
          actionConfig: rule.action_config
        },
        timestamp: new Date().toISOString()
      };

      // Queue webhook execution with retry configuration
      await this.webhookQueue.add('webhook', {
        executionId,
        integrationType: rule.integration_type,
        integrationConfig: rule.integration_config,
        integrationCredentials: rule.integration_credentials,
        payload
      }, {
        priority: rule.integration_type === 'webhook' ? 10 : 5,
        delay: 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 50
      });

      this.logger.info(`🎯 Queued ${rule.integration_type} webhook for rule: ${rule.name}`);

    } catch (error) {
      this.logger.error(error, `Error executing automation rule ${rule.id}`);
    }
  }

  private async executeWebhook(data: {
    executionId: string;
    integrationType: string;
    integrationConfig: Record<string, unknown>;
    integrationCredentials: Record<string, unknown>;
    payload: Record<string, unknown>;
  }) {
    const { executionId, integrationType, integrationConfig, integrationCredentials, payload } = data;

    try {
      // Update execution status to executing
      await this.updateExecutionStatus(executionId, AUTOMATION_STATUS.PENDING);

      // Get integration handler
      const integration = this.integrations.get(integrationType);
      if (!integration) {
        throw new Error(`Unknown integration type: ${integrationType}`);
      }

      // Execute webhook
      const result = await integration.execute(payload, integrationConfig, integrationCredentials);

      // Update execution status to success
      await this.updateExecutionStatus(executionId, AUTOMATION_STATUS.SUCCESS, JSON.stringify(result));

      this.logger.info(`✅ Successfully executed ${integrationType} webhook for execution ${executionId}`);
      return result;

    } catch (error) {
      this.logger.error(error, `❌ Failed to execute webhook for execution ${executionId}`);

      // Update execution status to failed
      await this.updateExecutionStatus(executionId, AUTOMATION_STATUS.FAILED, undefined, (error as Error).message);

      throw error;
    }
  }

  private async updateExecutionStatus(executionId: string, status: string, responseData?: string, errorMessage?: string) {
    const query = `
      UPDATE automation_executions 
      SET 
        status = $1,
        response_data = $2,
        error_message = $3,
        completed_at = CASE WHEN $1 IN ('success', 'failed') THEN NOW() ELSE completed_at END
      WHERE id = $4
    `;

    await this.pgClient.query(query, [
      status,
      responseData || null,
      errorMessage,
      executionId
    ]);
  }

  private async handleDeadLetterQueue(jobData: any, error: Error) {
    try {
      // Log to dead letter queue for manual intervention

      // Store in database for later replay
      const dlqQuery = `
        INSERT INTO dead_letter_queue (job_type, job_data, error_message, failed_at)
        VALUES ('webhook', $1, $2, NOW())
      `;

      await this.pgClient.query(dlqQuery, [
        JSON.stringify(jobData),
        error.message
      ]);

      this.logger.error(`💀 Moved job to dead letter queue: ${error.message}`);

    } catch (dlqError) {
      this.logger.error(dlqError, 'Failed to handle dead letter queue');
    }
  }

  // Method to replay failed jobs from DLQ (for admin interface)
  async replayFromDLQ(dlqId: string): Promise<void> {
    try {
      const dlqQuery = `
        SELECT job_data, id FROM dead_letter_queue 
        WHERE id = $1 AND status = 'failed'
      `;
      
      const result = await this.pgClient.query(dlqQuery, [dlqId]);
      
      if (result.rows.length === 0) {
        throw new Error(`DLQ record ${dlqId} not found or already processed`);
      }

      const jobData = JSON.parse(result.rows[0].job_data);
      
      // Re-queue the job
      await this.webhookQueue.add('webhook', jobData, {
        priority: 1, // High priority for manual replays
        attempts: 1,
        removeOnComplete: 10,
        removeOnFail: 10
      });

      // Mark DLQ record as replayed
      await this.pgClient.query(
        'UPDATE dead_letter_queue SET status = $1, replayed_at = NOW() WHERE id = $2',
        ['replayed', dlqId]
      );

      this.logger.info(`🔄 Replayed job from DLQ: ${dlqId}`);

    } catch (error) {
      this.logger.error(error, `Failed to replay job from DLQ: ${dlqId}`);
      throw error;
    }
  }
}