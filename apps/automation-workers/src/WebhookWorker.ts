import { Worker } from 'bullmq';
import { Pool } from 'pg';
import axios, { AxiosRequestConfig } from 'axios';
import { Logger } from 'pino';
import { createHmac } from 'crypto';

interface WebhookJobData {
  deliveryId: string;
  automationId: string;
  ruleId: string;
  geventId: string;
  accountId: string;
}

interface AutomationConfig {
  id: string;
  name: string;
  kind: 'notion' | 'sheets' | 'slack' | 'webhook' | 'whatsapp';
  config: any;
}

interface GeofenceEvent {
  id: string;
  deviceId: string;
  geofenceId: string;
  type: 'enter' | 'exit' | 'dwell';
  timestamp: string;
  dwellSeconds?: number;
  deviceName: string;
  geofenceName: string;
}

export class WebhookWorker {
  private worker: Worker;
  private dbPool: Pool;
  private logger: Logger;

  constructor(dbPool: Pool, logger: Logger, redisConfig: any) {
    this.dbPool = dbPool;
    this.logger = logger;

    this.worker = new Worker(
      'webhook-delivery',
      this.processWebhookJob.bind(this),
      {
        connection: redisConfig,
        concurrency: 10,
        removeOnComplete: { age: 24 * 60 * 60, count: 100 }, // Keep 100 jobs or 24 hours
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 50 },  // Keep 50 failed jobs or 7 days
      }
    );

    this.worker.on('completed', (job) => {
      this.logger.info({ jobId: job.id }, 'Webhook delivery completed successfully');
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error({ jobId: job?.id, error: err }, 'Webhook delivery failed');
    });

    this.worker.on('error', (err) => {
      this.logger.error({ error: err }, 'Webhook worker error');
    });
  }

  private async processWebhookJob(job: any): Promise<void> {
    const jobData: WebhookJobData = job.data;
    const logger = this.logger.child({ deliveryId: jobData.deliveryId });

    try {
      // Get automation and event details
      const [automation, geofenceEvent] = await Promise.all([
        this.getAutomation(jobData.automationId),
        this.getGeofenceEvent(jobData.geventId)
      ]);

      if (!automation || !geofenceEvent) {
        throw new Error('Missing automation or geofence event data');
      }

      logger.info({
        automationType: automation.kind,
        eventType: geofenceEvent.type,
        geofence: geofenceEvent.geofenceName,
        device: geofenceEvent.deviceName
      }, 'Processing webhook delivery');

      // Only support webhook for now
      let result: any;
      if (automation.kind === 'webhook') {
        result = await this.deliverGenericWebhook(automation, geofenceEvent);
      } else {
        throw new Error(`Integration type ${automation.kind} not supported yet`);
      }

      // Update delivery status to success
      await this.updateDeliveryStatus(jobData.deliveryId, 'success', null, result);

    } catch (error) {
      logger.error({ error }, 'Webhook delivery failed');

      // Update delivery status to failed and increment attempt count
      await this.updateDeliveryStatus(
        jobData.deliveryId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error',
        null
      );

      // Rethrow to mark job as failed for retry
      throw error;
    }
  }

  private async getAutomation(automationId: string): Promise<AutomationConfig | null> {
    try {
      const result = await this.dbPool.query(
        'SELECT id, name, kind, config FROM automations WHERE id = $1',
        [automationId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      this.logger.error({ error, automationId }, 'Failed to fetch automation');
      return null;
    }
  }

  private async getGeofenceEvent(geventId: string): Promise<GeofenceEvent | null> {
    try {
      const result = await this.dbPool.query(`
        SELECT 
          ge.id,
          ge.device_id,
          ge.geofence_id,
          ge.type,
          ge.ts as timestamp,
          ge.dwell_seconds,
          d.name as device_name,
          g.name as geofence_name
        FROM geofence_events ge
        JOIN devices d ON ge.device_id = d.id
        JOIN geofences g ON ge.geofence_id = g.id
        WHERE ge.id = $1
      `, [geventId]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        deviceId: row.device_id,
        geofenceId: row.geofence_id,
        type: row.type,
        timestamp: row.timestamp,
        dwellSeconds: row.dwell_seconds,
        deviceName: row.device_name,
        geofenceName: row.geofence_name
      };
    } catch (error) {
      this.logger.error({ error, geventId }, 'Failed to fetch geofence event');
      return null;
    }
  }

  private async deliverSlackWebhook(automation: AutomationConfig, event: GeofenceEvent): Promise<any> {
    const { webhook_url, channel, template } = automation.config;

    const message = this.renderTemplate(template || this.getDefaultSlackTemplate(), {
      device: event.deviceName,
      geofence: event.geofenceName,
      event: event.type,
      timestamp: new Date(event.timestamp).toLocaleString(),
      dwellTime: event.dwellSeconds ? `${Math.round(event.dwellSeconds / 60)} minutes` : null
    });

    const payload = {
      channel: channel || '#general',
      username: 'GeoFence Bot',
      icon_emoji: ':round_pushpin:',
      text: message,
      attachments: [{
        color: event.type === 'enter' ? 'good' : event.type === 'exit' ? 'warning' : 'danger',
        fields: [{
          title: 'Device',
          value: event.deviceName,
          short: true
        }, {
          title: 'Geofence',
          value: event.geofenceName,
          short: true
        }, {
          title: 'Event',
          value: event.type.charAt(0).toUpperCase() + event.type.slice(1),
          short: true
        }, {
          title: 'Time',
          value: new Date(event.timestamp).toLocaleString(),
          short: true
        }]
      }]
    };

    const response = await axios.post(webhook_url, payload);
    return { status: response.status, data: response.data };
  }

  private async deliverNotionWebhook(automation: AutomationConfig, event: GeofenceEvent): Promise<any> {
    const { access_token, database_id, properties } = automation.config;

    const notionProperties: any = {
      'Device': {
        title: [{ text: { content: event.deviceName } }]
      },
      'Geofence': {
        rich_text: [{ text: { content: event.geofenceName } }]
      },
      'Event Type': {
        select: { name: event.type }
      },
      'Timestamp': {
        date: { start: event.timestamp }
      }
    };

    if (event.dwellSeconds) {
      notionProperties['Dwell Time (minutes)'] = {
        number: Math.round(event.dwellSeconds / 60)
      };
    }

    // Merge with custom properties if provided
    if (properties) {
      Object.assign(notionProperties, properties);
    }

    const payload = {
      parent: { database_id },
      properties: notionProperties
    };

    const response = await axios.post('https://api.notion.com/v1/pages', payload, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });

    return { status: response.status, data: response.data };
  }

  private async deliverSheetsWebhook(automation: AutomationConfig, event: GeofenceEvent): Promise<any> {
    const { access_token, spreadsheet_id, range } = automation.config;

    const values = [[
      new Date(event.timestamp).toLocaleString(),
      event.deviceName,
      event.geofenceName,
      event.type,
      event.dwellSeconds ? Math.round(event.dwellSeconds / 60) : ''
    ]];

    const payload = {
      range: range || 'Sheet1!A:E',
      majorDimension: 'ROWS',
      values
    };

    const response = await axios.post(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${range || 'Sheet1!A:E'}:append?valueInputOption=RAW`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { status: response.status, data: response.data };
  }

  private async deliverWhatsAppWebhook(automation: AutomationConfig, event: GeofenceEvent): Promise<any> {
    // Implement WhatsApp delivery via Twilio or Meta Business API
    const { api_key, phone_number, template } = automation.config;

    const message = this.renderTemplate(template || this.getDefaultWhatsAppTemplate(), {
      device: event.deviceName,
      geofence: event.geofenceName,
      event: event.type,
      timestamp: new Date(event.timestamp).toLocaleString()
    });

    // This is a placeholder - implement based on your WhatsApp API provider
    const payload = {
      to: phone_number,
      type: 'text',
      text: { body: message }
    };

    // Example for Twilio
    const response = await axios.post('https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT/Messages.json',
      new URLSearchParams({
        To: phone_number,
        From: 'whatsapp:+14155238886',
        Body: message
      }), {
      auth: {
        username: 'YOUR_ACCOUNT_SID',
        password: api_key
      }
    }
    );

    return { status: response.status, data: response.data };
  }

  private async deliverGenericWebhook(automation: AutomationConfig, event: GeofenceEvent): Promise<any> {
    const { url, headers = {}, template } = automation.config;

    let payload: any = {
      event: {
        type: event.type,
        timestamp: event.timestamp,
        device: {
          id: event.deviceId,
          name: event.deviceName
        },
        geofence: {
          id: event.geofenceId,
          name: event.geofenceName
        }
      }
    };

    if (event.dwellSeconds) {
      payload.event.dwellSeconds = event.dwellSeconds;
    }

    // Apply template if provided
    if (template) {
      payload = JSON.parse(this.renderTemplate(template, {
        device: event.deviceName,
        geofence: event.geofenceName,
        event: event.type,
        timestamp: event.timestamp,
        deviceId: event.deviceId,
        geofenceId: event.geofenceId,
        dwellSeconds: event.dwellSeconds
      }));
    }

    // Add webhook signature for security
    const signature = this.generateWebhookSignature(JSON.stringify(payload), automation.id);
    headers['X-GeoFence-Signature'] = signature;
    headers['X-GeoFence-Timestamp'] = Date.now().toString();

    const config: AxiosRequestConfig = {
      method: 'POST',
      url,
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GeoFence-Webhooks/1.0',
        ...headers
      },
      timeout: 30000
    };

    const response = await axios.request(config);
    return { status: response.status, data: response.data };
  }

  private generateWebhookSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  private getDefaultSlackTemplate(): string {
    return '🎯 *{{event}}* event: {{device}} has {{event}}ed {{geofence}} at {{timestamp}}';
  }

  private getDefaultWhatsAppTemplate(): string {
    return '📍 {{device}} has {{event}}ed {{geofence}} at {{timestamp}}';
  }

  private async updateDeliveryStatus(
    deliveryId: string,
    status: 'success' | 'failed',
    error: string | null,
    responseData: any
  ): Promise<void> {
    try {
      await this.dbPool.query(`
        UPDATE deliveries 
        SET status = $2, 
            last_error = $3, 
            attempt = attempt + 1,
            updated_at = NOW()
        WHERE id = $1
      `, [deliveryId, status, error]);

      // If failed and max retries exceeded, move to DLQ (this is handled by database trigger)

    } catch (dbError) {
      this.logger.error({ dbError, deliveryId }, 'Failed to update delivery status');
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down webhook worker...');
    await this.worker.close();
    this.logger.info('Webhook worker shut down successfully');
  }
}