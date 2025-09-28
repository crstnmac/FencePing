import { z } from 'zod';

// Basic geometry schemas
const pointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]).refine(
    ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
    { message: 'Invalid coordinate values' }
  )
});

const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(
    z.array(
      z.tuple([z.number(), z.number()]).refine(
        ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
        { message: 'Invalid coordinate values' }
      )
    ).min(4, 'Polygon must have at least 4 coordinates')
  ).min(1, 'Polygon must have at least one ring')
});

const multiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(
    z.array(
      z.array(
        z.tuple([z.number(), z.number()]).refine(
          ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
          { message: 'Invalid coordinate values' }
        )
      ).min(4, 'Each polygon must have at least 4 coordinates')
    ).min(1, 'Each polygon must have at least one ring')
  ).min(1, 'MultiPolygon must have at least one polygon')
});

const geometrySchema = z.discriminatedUnion('type', [
  pointSchema,
  polygonSchema,
  multiPolygonSchema
]);

// Backend geofence schema (what comes from API)
export const backendGeofenceSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  geofence_type: z.enum(['polygon', 'circle', 'point']),
  geometry: geometrySchema,
  is_active: z.boolean(),
  radius_m: z.number().positive({ message: 'Radius must be positive' }).optional(),
  metadata: z.record(z.any(), z.unknown()).optional(),
  created_at: z.string().datetime({ message: 'Invalid datetime format' }),
  updated_at: z.string().datetime({ message: 'Invalid datetime format' })
}).refine(
  (data) => {
    // Circle type should have radius and Point geometry
    if (data.geofence_type === 'circle') {
      return data.geometry.type === 'Point' && data.radius_m && data.radius_m > 0;
    }
    // Point type should have Point geometry and no radius
    if (data.geofence_type === 'point') {
      return data.geometry.type === 'Point' && !data.radius_m;
    }
    // Polygon type should have Polygon or MultiPolygon geometry
    if (data.geofence_type === 'polygon') {
      return data.geometry.type === 'Polygon' || data.geometry.type === 'MultiPolygon';
    }
    return true;
  },
  { message: 'Geofence type must match geometry type' }
);

// Frontend geofence schema (what we use in UI)
export const frontendGeofenceSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  geometry: geometrySchema,
  radius: z.number().positive({ message: 'Radius must be positive' }).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  isActive: z.boolean(),
  type: z.enum(['polygon', 'circle', 'point'])
}).refine(
  (data) => {
    // Circle type should have radius and Point geometry
    if (data.type === 'circle') {
      return data.geometry.type === 'Point' && data.radius && data.radius > 0;
    }
    // Point type should have Point geometry and no radius
    if (data.type === 'point') {
      return data.geometry.type === 'Point' && !data.radius;
    }
    // Polygon type should have Polygon or MultiPolygon geometry
    if (data.type === 'polygon') {
      return data.geometry.type === 'Polygon' || data.geometry.type === 'MultiPolygon';
    }
    return true;
  },
  { message: 'Geofence type must match geometry type' }
);

// Create geofence request schema
export const createGeofenceRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  geofence_type: z.enum(['polygon', 'circle', 'point']),
  geometry: geometrySchema,
  is_active: z.boolean().default(true),
  radius_m: z.number().positive({ message: 'Radius must be positive' }).optional(),
  metadata: z.record(z.any(), z.unknown()).optional().default({})
}).refine(
  (data) => {
    if (data.geofence_type === 'circle') {
      return data.geometry.type === 'Point' && data.radius_m && data.radius_m > 0;
    }
    if (data.geofence_type === 'point') {
      return data.geometry.type === 'Point' && !data.radius_m;
    }
    if (data.geofence_type === 'polygon') {
      return data.geometry.type === 'Polygon' || data.geometry.type === 'MultiPolygon';
    }
    return true;
  },
  { message: 'Geofence type must match geometry type and radius requirements' }
);

// Update geofence request schema
export const updateGeofenceRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  geometry: geometrySchema.optional(),
  is_active: z.boolean().optional(),
  radius_m: z.number().positive({ message: 'Radius must be positive' }).optional(),
  metadata: z.record(z.any(), z.unknown()).optional()
});

// Bulk operation result schema
export const bulkOperationResultSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    id: z.string(),
    success: z.boolean(),
    error: z.string().optional()
  })),
  totalProcessed: z.number().int().min(0),
  successCount: z.number().int().min(0),
  failureCount: z.number().int().min(0)
});

// API response schemas
export const geofenceListResponseSchema = z.object({
  data: z.array(backendGeofenceSchema),
  total: z.number().int().min(0)
});

export const geofenceResponseSchema = z.object({
  data: backendGeofenceSchema
});

// Type exports
export type BackendGeofence = z.infer<typeof backendGeofenceSchema>;
export type FrontendGeofence = z.infer<typeof frontendGeofenceSchema>;
export type CreateGeofenceRequest = z.infer<typeof createGeofenceRequestSchema>;
export type UpdateGeofenceRequest = z.infer<typeof updateGeofenceRequestSchema>;
export type GeofenceGeometry = z.infer<typeof geometrySchema>;
export type BulkOperationResult = z.infer<typeof bulkOperationResultSchema>;

/**
 * Validates and parses data with detailed error messages
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string = 'data'
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errors = result.error.issues.map((error: any) => {
        const path = error.path.length > 0 ? `${error.path.join('.')}: ` : '';
        return `${path}${error.message}`;
      });

      console.warn(`Validation failed for ${context}:`, errors);
      return { success: false, errors };
    }
  } catch (error) {
    console.error(`Unexpected validation error for ${context}:`, error);
    return { success: false, errors: ['Unexpected validation error'] };
  }
}

/**
 * Validates backend geofence data
 */
export function validateBackendGeofence(data: unknown): BackendGeofence | null {
  const result = validateData(backendGeofenceSchema, data, 'backend geofence');
  return result.success ? result.data : null;
}

/**
 * Validates frontend geofence data
 */
export function validateFrontendGeofence(data: unknown): FrontendGeofence | null {
  const result = validateData(frontendGeofenceSchema, data, 'frontend geofence');
  return result.success ? result.data : null;
}

/**
 * Validates create geofence request data
 */
export function validateCreateRequest(data: unknown): CreateGeofenceRequest | null {
  const result = validateData(createGeofenceRequestSchema, data, 'create geofence request');
  return result.success ? result.data : null;
}

/**
 * Validates update geofence request data
 */
export function validateUpdateRequest(data: unknown): UpdateGeofenceRequest | null {
  const result = validateData(updateGeofenceRequestSchema, data, 'update geofence request');
  return result.success ? result.data : null;
}

/**
 * Validates geometry data specifically
 */
export function validateGeometry(data: unknown): GeofenceGeometry | null {
  const result = validateData(geometrySchema, data, 'geometry');
  return result.success ? result.data : null;
}