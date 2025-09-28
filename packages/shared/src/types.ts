import { z } from 'zod/v4';

export const DeviceLocationSchema = z.object({
  deviceId: z.uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracy: z.number().min(0).optional(),
  timestamp: z.iso.datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const GeofenceSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  accountId: z.uuid(),
  geometry: z.object({
    type: z.enum(['circle', 'polygon']),
    coordinates: z.union([
      z.object({
        center: z.tuple([z.number(), z.number()]),
        radius: z.number().min(1)
      }),
      z.array(z.tuple([z.number(), z.number()])).min(3)
    ])
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().default(true)
});

export const AutomationRuleSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  accountId: z.uuid(),
  geofenceId: z.uuid(),
  deviceId: z.string().uuid().optional(),
  integrationId: z.string().uuid(),
  triggerType: z.enum(['enter', 'exit', 'dwell']),
  dwellTimeMinutes: z.number().min(0).default(0),
  actionConfig: z.record(z.string(), z.unknown()),
  enabled: z.boolean().default(true)
});

export const IntegrationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1).max(255),
  type: z.enum(['notion', 'google_sheets', 'slack', 'whatsapp', 'webhook']),
  accountId: z.string().uuid(),
  config: z.record(z.string(), z.unknown()),
  credentials: z.record(z.string(), z.unknown()),
  enabled: z.boolean().default(true)
});

export const EventSchema = z.object({
  id: z.uuid().optional(),
  eventType: z.string(),
  deviceId: z.uuid().optional(),
  geofenceId: z.uuid().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.iso.datetime()
});

export type DeviceLocation = z.infer<typeof DeviceLocationSchema>;
export type Geofence = z.infer<typeof GeofenceSchema>;
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;
export type Integration = z.infer<typeof IntegrationSchema>;
export type Event = z.infer<typeof EventSchema>;

export interface GeofenceEvent {
  type: 'enter' | 'exit' | 'dwell';
  deviceId: string;
  geofenceId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: Date;
  dwellTimeMinutes?: number;
  metadata?: Record<string, unknown>;
}

export interface WebhookPayload extends Record<string, unknown> {
  event: GeofenceEvent;
  device: {
    id: string;
    name: string;
  };
  geofence: {
    id: string;
    name: string;
  };
  timestamp: string;
}

// Location event interface for internal processing
export interface LocationEvent {
  deviceId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  altitude?: number;
  metadata?: Record<string, unknown>;
}

// Processor configuration interface
export interface ProcessorConfig {
  dbConnectionString: string;
  kafkaConfig: {
    brokers: string[];
    clientId: string;
  };
  hysteresis: {
    timeoutSeconds: number;
  };
  gpsAccuracy: {
    thresholdMeters: number;
  };
}

// Settings-related types
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  timezone?: string;
  created_at: Date;
  last_login_at?: Date;
  notification_preferences?: NotificationPreferences;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  timezone: string;
  date_format: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  time_format: '12' | '24';
  distance_unit: 'metric' | 'imperial';
  location_retention_days: number;
  event_retention_days: number;
  default_map_region?: 'auto' | 'us' | 'eu' | 'asia' | 'global';
  coordinate_format?: 'decimal' | 'dms';
  created_at?: Date;
  updated_at?: Date;
  member_count?: number;
}

export const NotificationPreferencesSchema = z.object({
  emailGeofenceEvents: z.boolean().default(true),
  emailAutomationFailures: z.boolean().default(true),
  emailWeeklyReports: z.boolean().default(false),
  pushGeofenceEvents: z.boolean().default(false),
  pushAutomationFailures: z.boolean().default(true),
  // Add more as needed
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export interface ApiKey {
  id: string;
  name: string;
  key?: string; // Only during creation
  permissions: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface UserSession {
  id: string;
  ip_address: string;
  user_agent: string;
  created_at: Date;
  last_activity_at?: Date;
  isCurrent: boolean;
}
