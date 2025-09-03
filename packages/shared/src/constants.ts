export const KAFKA_TOPICS = {
  RAW_EVENTS: 'raw_events',
  GEOFENCE_EVENTS: 'geofence_events',
  AUTOMATIONS: 'automations',
  AUDIT_LOG: 'audit_log'
} as const;

export const MQTT_TOPICS = {
  DEVICE_LOCATION: 'devices/+/location',
  DEVICE_STATUS: 'devices/+/status'
} as const;

export const INTEGRATION_TYPES = {
  NOTION: 'notion',
  GOOGLE_SHEETS: 'google_sheets',
  SLACK: 'slack',
  WHATSAPP: 'whatsapp',
  WEBHOOK: 'webhook'
} as const;

export const GEOFENCE_TRIGGER_TYPES = {
  ENTER: 'enter',
  EXIT: 'exit',
  DWELL: 'dwell'
} as const;

export const AUTOMATION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  RETRYING: 'retrying'
} as const;

export const DEFAULT_DWELL_TIME_MINUTES = 5;
export const DEFAULT_GEOFENCE_RADIUS_METERS = 100;
export const GPS_ACCURACY_THRESHOLD_METERS = 50;
export const HYSTERESIS_BUFFER_SECONDS = 30;