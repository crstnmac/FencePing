import axios from 'axios';
import { Logger } from 'pino';

export class GoogleSheetsIntegration {
  private logger: Logger;
  private baseURL = 'https://sheets.googleapis.com/v4/spreadsheets';

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<{ spreadsheetId: string; updatedRange?: string; updatedRows?: number }> {
    const { spreadsheetId, sheetName = 'Sheet1', columns = [] } = config;
    const { accessToken } = credentials;

    if (!accessToken || !spreadsheetId) {
      throw new Error('Google Sheets access token and spreadsheet ID are required');
    }

    // Build row data
    const rowData = this.buildRowData(payload, columns as string[]);

    try {
      const response = await axios.post(
        `${this.baseURL}/${spreadsheetId}/values/${sheetName}:append`,
        {
          range: `${sheetName}!A:Z`,
          majorDimension: 'ROWS',
          values: [rowData]
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            valueInputOption: 'USER_ENTERED'
          },
          timeout: 10000
        }
      );

      this.logger.info(`📊 Added row to Google Sheet ${spreadsheetId as string}`);
      
      return {
        spreadsheetId: spreadsheetId as string,
        updatedRange: response.data.updates?.updatedRange,
        updatedRows: response.data.updates?.updatedRows
      };

    } catch (error: any) {
      this.logger.error('📊 Google Sheets integration failed:', error.response?.data || error.message);
      throw error;
    }
  }

  private buildRowData(
    payload: Record<string, unknown>,
    columns: string[]
  ): string[] {
    // Type guards for payload properties
    const event = payload.event as { 
      type?: string; 
      timestamp?: string; 
      location?: { latitude: number; longitude: number } 
    } | undefined;
    const device = payload.device as { name?: string } | undefined;
    const geofence = payload.geofence as { name?: string } | undefined;

    if (columns.length === 0) {
      // Default columns
      return [
        event?.timestamp ? new Date(event.timestamp).toLocaleString() : new Date().toLocaleString(),
        event?.type || 'Unknown',
        device?.name || 'Unknown Device',
        geofence?.name || 'Unknown Geofence',
        event?.location ? `${event.location.latitude}, ${event.location.longitude}` : 'Unknown Location'
      ];
    }

    // Map custom columns
    return columns.map(column => {
      switch (column.toLowerCase()) {
        case 'timestamp':
          return event?.timestamp ? new Date(event.timestamp).toLocaleString() : new Date().toLocaleString();
        case 'event':
        case 'event_type':
          return event?.type || 'Unknown';
        case 'device':
        case 'device_name':
          return device?.name || 'Unknown Device';
        case 'geofence':
        case 'geofence_name':
          return geofence?.name || 'Unknown Geofence';
        case 'location':
          return event?.location ? `${event.location.latitude}, ${event.location.longitude}` : 'Unknown Location';
        case 'latitude':
          return event?.location ? event.location.latitude.toString() : '0';
        case 'longitude':
          return event?.location ? event.location.longitude.toString() : '0';
       default:
          return '';
      }
    });
  }
}