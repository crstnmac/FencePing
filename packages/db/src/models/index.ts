export interface User {
  id: number;
  name: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export interface Device {
  id: number;
  device_id: string;
  name: string;
  user_id: number;
  last_seen?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Geofence {
  id: number;
  name: string;
  type: 'circle' | 'polygon';
  center_lat?: number;
  center_lng?: number;
  radius?: number;
  polygon?: string; // GeoJSON string for polygon geofences
  user_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LocationEvent {
  id: number;
  device_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
  event_type: 'location_update';
  created_at: Date;
}

export interface GeofenceEvent {
  id: number;
  device_id: string;
  geofence_id: number;
  event_type: 'enter' | 'exit' | 'dwell';
  latitude: number;
  longitude: number;
  timestamp: Date;
  created_at: Date;
}

export interface Automation {
  id: number;
  name: string;
  geofence_id: number;
  user_id: number;
  trigger_type: 'enter' | 'exit' | 'dwell';
  action_type: 'webhook' | 'notification' | 'email';
  action_config: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Integration {
  id: number;
  user_id: number;
  type: 'notion' | 'google_sheets' | 'slack' | 'whatsapp' | 'webhook';
  name: string;
  config: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}