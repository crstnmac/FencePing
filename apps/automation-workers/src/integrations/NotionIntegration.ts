import axios from 'axios';
import { Logger } from 'pino';
import { WebhookPayload } from '@geofence/shared';

export class NotionIntegration {
  private logger: Logger;
  private baseURL = 'https://api.notion.com/v1';

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(
    payload: WebhookPayload,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<{ pageId: string; url: string }> {
    const { databaseId, properties = {} } = config;
    const { accessToken } = credentials;

    if (!accessToken || !databaseId) {
      throw new Error('Notion access token and database ID are required');
    }

    // Build properties object
    const notionProperties = this.buildProperties(payload, properties as Record<string, unknown>);

    try {
      const response = await axios.post(
        `${this.baseURL}/pages`,
        {
          parent: { database_id: databaseId },
          properties: notionProperties
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          timeout: 10000
        }
      );

      this.logger.info(`📝 Created Notion page in database ${databaseId}`);
      
      return {
        pageId: response.data.id,
        url: response.data.url
      };

    } catch (error: any) {
      this.logger.error('📝 Notion integration failed:', error.response?.data || error.message);
      throw error;
    }
  }

  private buildProperties(
    payload: Record<string, unknown>,
    propertyMapping: Record<string, unknown>
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    
    // Type guards for payload properties
    const event = payload.event as { type: string; location?: { latitude: number; longitude: number }; timestamp?: string } | undefined;
    const geofence = payload.geofence as { name?: string } | undefined;
    const device = payload.device as { name?: string } | undefined;

    // Default properties
    properties.Event = {
      title: [{ text: { content: `${event?.type || 'Unknown'} - ${geofence?.name || 'Unknown Geofence'}` } }]
    };

    properties.Device = {
      rich_text: [{ text: { content: device?.name || 'Unknown Device' } }]
    };

    properties.Geofence = {
      rich_text: [{ text: { content: geofence?.name || 'Unknown Geofence' } }]
    };

    if (event?.location) {
      properties.Location = {
        rich_text: [{ 
          text: { 
            content: `${event.location.latitude}, ${event.location.longitude}` 
          } 
        }]
      };
    }

    if (event?.timestamp) {
      properties.Timestamp = {
        date: { start: event.timestamp }
      };
    }

    // Apply custom property mapping
    Object.keys(propertyMapping).forEach(key => {
      const mapping = propertyMapping[key] as { type?: string; value?: string } | undefined;
      if (mapping?.type === 'title') {
        properties[key] = {
          title: [{ text: { content: mapping.value || event?.type || 'Unknown' } }]
        };
      } else if (mapping?.type === 'rich_text') {
        properties[key] = {
          rich_text: [{ text: { content: mapping.value || '' } }]
        };
      } else if (mapping?.type === 'date') {
        properties[key] = {
          date: { start: mapping.value || event?.timestamp || new Date().toISOString() }
       };
      }
    });

    return properties;
  }
}