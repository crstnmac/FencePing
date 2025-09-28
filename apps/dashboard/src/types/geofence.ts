// Unified type definitions for geofences across frontend and backend

export interface GeofenceGeometry {
  type: 'Point' | 'Polygon' | 'MultiPolygon';
  coordinates: number[] | number[][] | number[][][];
}

export interface BackendGeofence {
  id: string;
  name: string;
  description?: string;
  geofence_type: 'polygon' | 'circle' | 'point';
  geometry: GeofenceGeometry;
  is_active: boolean;
  radius_m?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FrontendGeofence {
  id: string;
  name: string;
  description?: string;
  geometry: GeofenceGeometry;
  radius?: number; // in meters
  color: string;
  is_active: boolean;
  type: 'polygon' | 'circle' | 'point';
}

export interface CreateGeofenceRequest {
  name: string;
  description?: string;
  geofence_type: 'polygon' | 'circle' | 'point';
  geometry: GeofenceGeometry;
  is_active: boolean;
  radius_m?: number;
  metadata?: Record<string, any>;
}

export interface UpdateGeofenceRequest {
  name?: string;
  description?: string;
  geometry?: GeofenceGeometry;
  is_active?: boolean;
  radius_m?: number;
  metadata?: Record<string, any>;
}

export interface GeofenceOperationResult {
  success: boolean;
  data?: BackendGeofence;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface GeofenceBulkOperationResult {
  success: boolean;
  results: Array<{
    id: string;
    success: boolean;
    error?: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}