import {
  BackendGeofence,
  FrontendGeofence,
  CreateGeofenceRequest,
  UpdateGeofenceRequest,
  GeofenceGeometry,
} from '../types/geofence';

/**
 * Color mapping for different geofence types
 */
const GEOFENCE_COLORS = {
  polygon: '#3B82F6', // Blue
  circle: '#10B981', // Green
  point: '#F59E0B', // Orange
} as const;

/**
 * Validates if geometry has valid coordinate structure
 */
export function validateGeometry(geometry: GeofenceGeometry): boolean {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    return false;
  }

  const { type, coordinates } = geometry;

  switch (type) {
    case 'Point':
      return (
        Array.isArray(coordinates) &&
        coordinates.length === 2 &&
        coordinates.every((coord) => typeof coord === 'number')
      );

    case 'Polygon':
      return (
        Array.isArray(coordinates) &&
        coordinates.length > 0 &&
        Array.isArray(coordinates[0]) &&
        coordinates[0].length >= 4 && // Minimum 4 points for closed polygon
        Array.isArray(coordinates[0][0]) &&
        coordinates[0][0].length === 2
      );

    case 'MultiPolygon':
      return (
        Array.isArray(coordinates) &&
        coordinates.length > 0 &&
        coordinates.every(
          (polygon) => Array.isArray(polygon) && polygon.length > 0 && Array.isArray(polygon[0])
        )
      );

    default:
      return false;
  }
}

/**
 * Determines geofence type from geometry and radius
 */
export function determineGeofenceType(
  geometry: GeofenceGeometry,
  radius?: number
): 'polygon' | 'circle' | 'point' {
  if (geometry.type === 'Point') {
    return radius && radius > 0 ? 'circle' : 'point';
  }
  return 'polygon';
}

/**
 * Transforms backend geofence to frontend format
 */
export function transformToFrontend(backend: BackendGeofence): FrontendGeofence | null {
  try {
    console.log('🔍 transformToFrontend called with:', backend);

    // Validate required fields
    if (!backend.id || !backend.name || !backend.geometry) {
      console.warn(
        '❌ Invalid backend geofence data - missing required fields:',
        {
          hasId: !!backend.id,
          hasName: !!backend.name,
          hasGeometry: !!backend.geometry,
        },
        backend
      );
      return null;
    }

    // Validate geometry
    if (!validateGeometry(backend.geometry)) {
      console.warn('❌ Invalid geofence geometry:', backend.geometry);
      return null;
    }

    const type = backend.geofence_type || determineGeofenceType(backend.geometry, backend.radius_m);
    console.log('🎯 Determined type:', type, 'from geofence_type:', backend.geofence_type);

    const isActive = Boolean(backend.is_active);
    console.log('🔄 isActive conversion:', {
      'backend.is_active': backend.is_active,
      typeof: typeof backend.is_active,
      'Boolean(backend.is_active)': isActive,
    });

    const result = {
      id: String(backend.id),
      name: backend.name,
      description: backend.description,
      geometry: backend.geometry,
      radius: backend.radius_m,
      color: GEOFENCE_COLORS[type],
      is_active: isActive,
      type,
    };

    console.log('✅ Transform successful:', result);
    return result;
  } catch (error) {
    console.error('❌ Error transforming geofence to frontend:', error, backend);
    return null;
  }
}

/**
 * Transforms frontend geofence to backend creation request
 */
export function transformToCreateRequest(frontend: Omit<FrontendGeofence, 'id'>): any | null {
  try {
    // Validate required fields
    if (!frontend.name || !frontend.geometry) {
      console.warn('Invalid frontend geofence data for creation:', frontend);
      return null;
    }

    // Validate geometry
    if (!validateGeometry(frontend.geometry)) {
      console.warn('Invalid geofence geometry for creation:', frontend.geometry);
      return null;
    }

    const geofence_type =
      frontend.type || determineGeofenceType(frontend.geometry, frontend.radius);

    // Transform to API format based on type
    if (geofence_type === 'circle') {
      const coords = frontend.geometry.coordinates as [number, number];
      return {
        type: 'circle',
        name: frontend.name.trim(),
        description: frontend.description?.trim(),
        center: {
          longitude: coords[0],
          latitude: coords[1],
        },
        radius: frontend.radius || 100, // Default radius if not provided
        metadata: {},
      };
    } else if (geofence_type === 'polygon') {
      // Convert GeoJSON coordinates to API format
      const coords = frontend.geometry.coordinates as number[][][];
      const coordinatesArray = coords[0].map((coord) => ({
        longitude: coord[0],
        latitude: coord[1],
      }));

      return {
        type: 'polygon',
        name: frontend.name.trim(),
        description: frontend.description?.trim(),
        coordinates: coordinatesArray,
        metadata: {},
      };
    } else if (geofence_type === 'point') {
      const coords = frontend.geometry.coordinates as [number, number];
      return {
        type: 'point',
        name: frontend.name.trim(),
        description: frontend.description?.trim(),
        coordinates: [
          {
            longitude: coords[0],
            latitude: coords[1],
          },
        ],
        metadata: {},
      };
    }

    return null;
  } catch (error) {
    console.error('Error transforming geofence to create request:', error, frontend);
    return null;
  }
}

/**
 * Transforms partial frontend update to backend update request
 */
export function transformToUpdateRequest(
  updates: Partial<FrontendGeofence>
): UpdateGeofenceRequest | null {
  try {
    const backendUpdates: UpdateGeofenceRequest = {};

    // Only include fields that are provided and valid
    if (updates.name !== undefined) {
      if (typeof updates.name === 'string' && updates.name.trim().length > 0) {
        backendUpdates.name = updates.name.trim();
      } else {
        console.warn('Invalid name in geofence update:', updates.name);
        return null;
      }
    }

    if (updates.description !== undefined) {
      backendUpdates.description =
        typeof updates.description === 'string' ? updates.description.trim() : undefined;
    }

    if (updates.geometry !== undefined) {
      if (validateGeometry(updates.geometry)) {
        backendUpdates.geometry = updates.geometry;
      } else {
        console.warn('Invalid geometry in geofence update:', updates.geometry);
        return null;
      }
    }

    if (updates.is_active !== undefined) {
      backendUpdates.is_active = Boolean(updates.is_active);
    }

    if (updates.radius !== undefined) {
      backendUpdates.radius_m = updates.radius && updates.radius > 0 ? updates.radius : undefined;
    }

    // Return null if no valid updates
    if (Object.keys(backendUpdates).length === 0) {
      console.warn('No valid updates provided');
      return null;
    }

    return backendUpdates;
  } catch (error) {
    console.error('Error transforming geofence updates:', error, updates);
    return null;
  }
}

/**
 * Transforms multiple backend geofences to frontend format
 */
export function transformMultipleToFrontend(backend: BackendGeofence[]): FrontendGeofence[] {
  if (!Array.isArray(backend)) {
    console.warn('Expected array of geofences, got:', typeof backend);
    return [];
  }

  console.log('🔄 Transforming geofences:', backend.length, 'items');
  console.log('📋 Raw backend data:', backend);

  const transformed = backend
    .map((item, index) => {
      console.log(`🔄 Transforming geofence ${index}:`, item);
      const result = transformToFrontend(item);
      console.log(`✅ Transformed result ${index}:`, result);
      return result;
    })
    .filter((geofence): geofence is FrontendGeofence => geofence !== null);

  console.log('🎯 Final transformed array:', transformed);
  return transformed;
}

/**
 * Creates a deep copy of a geofence for duplication
 */
export function duplicateGeofence(
  geofence: FrontendGeofence,
  suffix: string = ' (Copy)'
): Omit<FrontendGeofence, 'id'> {
  return {
    name: `${geofence.name}${suffix}`,
    description: geofence.description,
    geometry: JSON.parse(JSON.stringify(geofence.geometry)), // Deep copy
    radius: geofence.radius,
    color: geofence.color,
    is_active: geofence.is_active,
    type: geofence.type,
  };
}

/**
 * Calculates approximate area for a geofence (in square meters)
 */
export function calculateGeofenceArea(geofence: FrontendGeofence): number {
  try {
    if (geofence.type === 'circle' && geofence.radius) {
      return Math.PI * Math.pow(geofence.radius, 2);
    }

    if (geofence.type === 'polygon' && geofence.geometry.type === 'Polygon') {
      // Simplified area calculation for polygon (not geodesically accurate)
      const coordinates = geofence.geometry.coordinates as number[][][];
      if (!Array.isArray(coordinates[0]) || !Array.isArray(coordinates[0][0])) return 0;

      let area = 0;
      const ring = coordinates[0];

      for (let i = 0; i < ring.length - 1; i++) {
        if (Array.isArray(ring[i]) && Array.isArray(ring[i + 1])) {
          area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        }
      }

      return Math.abs(area / 2) * 12100000000; // Rough conversion to square meters
    }

    return 0;
  } catch (error) {
    console.error('Error calculating geofence area:', error, geofence);
    return 0;
  }
}
