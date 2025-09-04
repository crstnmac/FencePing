import { z } from 'zod';

export const DeviceLocationSchema = z.object({
  deviceId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracy: z.number().min(0).optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const GeofenceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  accountId: z.string().uuid(),
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
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true)
});

export const AutomationRuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  accountId: z.string().uuid(),
  geofenceId: z.string().uuid(),
  deviceId: z.string().uuid().optional(),
  integrationId: z.string().uuid(),
  triggerType: z.enum(['enter', 'exit', 'dwell']),
  dwellTimeMinutes: z.number().min(0).default(0),
  actionConfig: z.record(z.unknown()),
  isActive: z.boolean().default(true)
});

export const IntegrationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  type: z.enum(['notion', 'google_sheets', 'slack', 'whatsapp', 'webhook']),
  accountId: z.string().uuid(),
  config: z.record(z.unknown()),
  credentials: z.record(z.unknown()),
  isActive: z.boolean().default(true)
});

export const EventSchema = z.object({
  id: z.string().uuid().optional(),
  eventType: z.string(),
  deviceId: z.string().uuid().optional(),
  geofenceId: z.string().uuid().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime()
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