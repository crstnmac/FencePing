import axios from 'axios';
import { Logger } from 'pino';

export class WhatsAppIntegration {
  private logger: Logger;
  private facebookApiUrl = 'https://graph.facebook.com/v18.0';

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<{ messageId: string; status: string; platform: string }> {
    // Support both WhatsApp Business API and Twilio
    const { access_token, phone_number_id } = credentials;
    const { phone_number } = config;

    if (!phone_number) {
      throw new Error('WhatsApp phone number is required');
    }

    if (access_token && phone_number_id) {
      // Use WhatsApp Business API
      return await this.sendBusinessAPIMessage(payload, config, credentials);
    } else {
      // Fallback to Twilio (legacy)
      return await this.sendTwilioMessage(payload, config, credentials);
    }
  }

  private async sendBusinessAPIMessage(
    payload: Record<string, unknown>,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<{ messageId: string; status: string; platform: string }> {
    const { phone_number, template_name, business_account_id } = config;
    const { access_token, phone_number_id } = credentials;

    const message = this.buildMessage(payload, config.messageTemplate as string | undefined);

    try {
      const phoneNumberToSend = (phone_number as string).replace(/^\+/, '');
      
      const messagePayload = {
        messaging_product: 'whatsapp',
        to: phoneNumberToSend,
        type: 'text',
        text: {
          preview_url: true,
          body: message
        }
      };

      const response = await axios.post(
        `${this.facebookApiUrl}/${phone_number_id}/messages`,
        messagePayload,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      this.logger.info(`📱 Sent WhatsApp Business message to ${phone_number}`);
      
      return {
        messageId: response.data.messages[0].id,
        status: 'sent',
        platform: 'whatsapp_business'
      };

    } catch (error: any) {
      this.logger.error('📱 WhatsApp Business API failed:', error.response?.data || error.message);
      throw error;
    }
  }

  private async sendTwilioMessage(
    payload: Record<string, unknown>,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<{ messageId: string; status: string; platform: string }> {
    const { phone_number, from } = config;
    const { account_sid, auth_token } = credentials;

    if (!account_sid || !auth_token) {
      throw new Error('Twilio credentials (account_sid, auth_token) are required for Twilio WhatsApp');
    }

    const message = this.buildMessage(payload, config.messageTemplate as string | undefined);

    try {
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
        new URLSearchParams({
          From: `whatsapp:${from || '+14155238886'}`, // Twilio sandbox number
          To: `whatsapp:${phone_number}`,
          Body: message
        }),
        {
          auth: {
            username: account_sid as string,
            password: auth_token as string
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 15000
        }
      );

      this.logger.info(`📱 Sent WhatsApp message via Twilio to ${phone_number}`);
      
      return {
        messageId: response.data.sid,
        status: response.data.status,
        platform: 'twilio'
      };

    } catch (error: any) {
      this.logger.error('📱 Twilio WhatsApp integration failed:', error.response?.data || error.message);
      throw error;
    }
  }

  private buildMessage(payload: Record<string, unknown>, template?: string): string {
    // Type guards for payload properties
    const event = payload.event as { 
      type?: string; 
      timestamp?: string; 
      location?: { latitude: number; longitude: number };
      metadata?: { dwellDurationMinutes?: number };
    } | undefined;
    const device = payload.device as { name?: string } | undefined;
    const geofence = payload.geofence as { name?: string } | undefined;

    const eventIcon = event?.type === 'enter' ? '🟢' : event?.type === 'exit' ? '🔴' : '⏱️';
    const actionText = event?.type === 'enter' ? 'entered' : 
                      event?.type === 'exit' ? 'exited' : 
                      'has been dwelling in';

    let defaultMessage = `${eventIcon} *Location Alert*

Device: *${device?.name || 'Unknown Device'}*
${actionText} geofence: *${geofence?.name || 'Unknown Geofence'}*`;

    // Add dwell duration for dwell events
    if (event?.type === 'dwell' && event.metadata?.dwellDurationMinutes) {
      defaultMessage += `\n⏱️ Duration: ${event.metadata.dwellDurationMinutes} minutes`;
    }

    if (event?.location) {
      defaultMessage += `\n\n📍 Location: ${event.location.latitude}, ${event.location.longitude}`;
      defaultMessage += `\nhttps://maps.google.com/maps?q=${event.location.latitude},${event.location.longitude}`;
    }

    if (event?.timestamp) {
      defaultMessage += `\n🕐 Time: ${new Date(event.timestamp).toLocaleString()}`;
    }

    if (!template) {
      return defaultMessage;
    }

    return template
      .replace(/\{event\.type\}/g, event?.type || 'Unknown')
      .replace(/\{device\.name\}/g, device?.name || 'Unknown Device')
      .replace(/\{geofence\.name\}/g, geofence?.name || 'Unknown Geofence')
      .replace(/\{location\.latitude\}/g, event?.location?.latitude?.toString() || '0')
      .replace(/\{location\.longitude\}/g, event?.location?.longitude?.toString() || '0')
      .replace(/\{timestamp\}/g, event?.timestamp ? new Date(event.timestamp).toLocaleString() : new Date().toLocaleString())
      .replace(/\{dwell_duration\}/g, event?.metadata?.dwellDurationMinutes?.toString() || '0');
  }
}