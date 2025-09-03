import type { GeofenceEvent, WebhookPayload } from './types.js';

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function isPointInCircle(
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(pointLat, pointLon, centerLat, centerLon);
  return distance <= radiusMeters;
}

export function formatWebhookPayload(
  event: {
    eventType: string;
    deviceId: string;
    geofenceId: string;
    location: { latitude: number; longitude: number };
    timestamp: string;
    metadata?: Record<string, unknown>;
  },
  device: {
    id: string;
    name: string;
  },
  geofence: {
    id: string;
    name: string;
  }
): WebhookPayload {
  return {
    event: {
      type: event.eventType as GeofenceEvent['type'],
      deviceId: event.deviceId,
      geofenceId: event.geofenceId,
      location: event.location,
      timestamp: new Date(event.timestamp),
      metadata: event.metadata
    },
    device: {
      id: device.id,
      name: device.name
    },
    geofence: {
      id: geofence.id,
      name: geofence.name
    },
    timestamp: new Date().toISOString()
  };
}

export function generateDeviceToken(): string {
  return `dev_${Math.random().toString(36).substring(2, 18)}`;
}

export function validateMQTTTopic(topic: string): boolean {
  const topicPattern = /^devices\/[a-zA-Z0-9_-]+\/(location|status)$/;
  return topicPattern.test(topic);
}