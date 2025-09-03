import axios from 'axios';
import { Logger } from 'pino';
import { WebhookPayload } from '@geofence/shared';

export class SlackIntegration {
  private logger: Logger;
  private baseURL = 'https://slack.com/api';

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(
    payload: WebhookPayload,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<{ messageId?: string; channel?: string; status: string }> {
    const { channel, messageTemplate, mention_users } = config;
    const { botToken, webhook_url } = credentials;

    // Support both bot token and webhook URL methods
    if (webhook_url) {
      return await this.sendWebhookMessage(payload, config, webhook_url as string);
    } else if (botToken && channel) {
      return await this.sendBotMessage(payload, config, botToken as string, channel as string);
    } else {
      throw new Error('Either Slack webhook URL or bot token with channel are required');
    }
  }

  private async sendWebhookMessage(
    payload: Record<string, unknown>,
    config: Record<string, unknown>,
    webhookUrl: string
  ): Promise<{ status: string; channel?: string }> {
    const { messageTemplate } = config;
    const message = this.buildMessage(payload, messageTemplate as string | undefined);

    try {
      const response = await axios.post(
        webhookUrl,
        {
          text: message.text,
          blocks: message.blocks
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.status !== 200 || response.data !== 'ok') {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      this.logger.info(`💬 Sent Slack webhook message successfully`);
      
      return {
        status: 'sent',
        channel: config.channel as string || 'webhook-channel'
      };

    } catch (error: any) {
      this.logger.error('💬 Slack webhook failed:', error.response?.data || error.message);
      throw error;
    }
  }

  private async sendBotMessage(
    payload: Record<string, unknown>,
    config: Record<string, unknown>,
    botToken: string,
    channel: string
  ): Promise<{ messageId: string; channel: string; status: string }> {
    const { messageTemplate, mention_users } = config;
    const message = this.buildMessage(payload, messageTemplate as string | undefined);

    // Add user mentions if enabled
    let messageText = message.text;
    if (mention_users) {
      messageText = `<!channel> ${messageText}`;
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/chat.postMessage`,
        {
          channel,
          text: messageText,
          blocks: message.blocks
        },
        {
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Unknown Slack API error');
      }

      this.logger.info(`💬 Sent Slack bot message to ${channel}`);
      
      return {
        messageId: response.data.ts,
        channel: response.data.channel,
        status: 'sent'
      };

    } catch (error: any) {
      this.logger.error('💬 Slack bot integration failed:', error.response?.data || error.message);
      throw error;
    }
  }

  private buildMessage(
    payload: Record<string, unknown>,
    template?: string
  ): { text: string; blocks: unknown[] } {
    // Type guards for payload properties
    const event = payload.event as { 
      type?: string; 
      timestamp?: string; 
      location?: { latitude: number; longitude: number } 
    } | undefined;
    const device = payload.device as { name?: string } | undefined;
    const geofence = payload.geofence as { name?: string } | undefined;

    const eventIcon = event?.type === 'enter' ? '🟢' : '🔴';
    const actionText = event?.type === 'enter' ? 'entered' : 'exited';

    const defaultText = `${eventIcon} Device "${device?.name || 'Unknown Device'}" ${actionText} geofence "${geofence?.name || 'Unknown Geofence'}"`;

    const text = template 
      ? this.substituteTemplate(template, payload)
      : defaultText;

    // Rich block format
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: event?.location 
              ? `📍 Location: ${event.location.latitude}, ${event.location.longitude}`
              : '📍 Location: Unknown'
          },
          {
            type: 'mrkdwn',
            text: event?.timestamp 
              ? `🕐 Time: ${new Date(event.timestamp).toLocaleString()}`
              : `🕐 Time: ${new Date().toLocaleString()}`
          }
        ]
      }
    ];

    return { text, blocks };
  }

  private substituteTemplate(
    template: string,
    payload: Record<string, unknown>
  ): string {
    // Type guards for payload properties
    const event = payload.event as { 
      type?: string; 
      timestamp?: string; 
      location?: { latitude: number; longitude: number } 
    } | undefined;
    const device = payload.device as { name?: string } | undefined;
    const geofence = payload.geofence as { name?: string } | undefined;

    return template
      .replace(/\{event\.type\}/g, event?.type || 'Unknown')
      .replace(/\{device\.name\}/g, device?.name || 'Unknown Device')
      .replace(/\{geofence\.name\}/g, geofence?.name || 'Unknown Geofence')
      .replace(/\{location\.latitude\}/g, event?.location?.latitude?.toString() || '0')
      .replace(/\{location\.longitude\}/g, event?.location?.longitude?.toString() || '0')
      .replace(/\{timestamp\}/g, event?.timestamp ? new Date(event.timestamp).toLocaleString() : new Date().toLocaleString());
  }
}