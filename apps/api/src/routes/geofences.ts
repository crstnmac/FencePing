import { Router } from 'express';
import { z } from 'zod';
import { query } from '@geofence/db';
import { validateBody, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const CreateCircleGeofenceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  center: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }),
  radius: z.number().min(1).max(10000),
  metadata: z.record(z.unknown()).optional()
});

const CreatePolygonGeofenceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  coordinates: z.array(z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  })).min(3),
  metadata: z.record(z.unknown()).optional()
});

const CreatePointGeofenceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  coordinates: z.array(z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  })).length(1),
  metadata: z.record(z.unknown()).optional()
});

const CreateGeofenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('circle') }).merge(CreateCircleGeofenceSchema),
  z.object({ type: z.literal('polygon') }).merge(CreatePolygonGeofenceSchema),
  z.object({ type: z.literal('point') }).merge(CreatePointGeofenceSchema)
]);

const UpdateGeofenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});

const TestLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

// Get all geofences for organization
router.get('/', requireAuth, requireAccount, async (req, res) => {
  // Using query() function for automatic connection management
  try {
    const queryText = `
      SELECT
        id,
        name,
        description,
        ST_AsGeoJSON(geometry) as geometry_geojson,
        metadata,
        is_active,
        created_at,
        updated_at,
        geofence_type,
        radius_m
      FROM geofences
      WHERE account_id = $1
      ORDER BY created_at DESC
    `;

    // For development, get the first available account if no auth
    let accountId = req.accountId;

    if (!accountId) {
      const accountResult = await query('SELECT id FROM accounts ORDER BY created_at LIMIT 1');
      if (accountResult.rows.length > 0) {
        accountId = accountResult.rows[0].id;
      } else {
        return res.status(400).json({
          success: false,
          error: 'No account found'
        });
      }
    }

    const result = await query(queryText, [accountId]);

    const geofences = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      geometry: JSON.parse(row.geometry_geojson),
      metadata: row.metadata,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      geofence_type: row.geofence_type,
      radius_m: row.radius_m
    }));

    res.json({
      success: true,
      data: geofences,
      total: geofences.length
    });
  } catch (error) {
    console.error('Error fetching geofences:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new geofence
router.post('/', requireAuth, requireAccount, validateBody(CreateGeofenceSchema), async (req, res) => {
  try {
    let queryText: string = '';
    let queryParams: any[] = [];

    if (req.body.type === 'circle') {
      const { center, radius } = req.body;
      queryText = `
        INSERT INTO geofences (name, description, account_id, geometry, geofence_type, metadata, radius_m)
        VALUES ($1, $2, $3, ST_Buffer(ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6)::geometry, $7, $8, $6)
        RETURNING id, name, description, geofence_type, ST_AsGeoJSON(geometry) as geometry_geojson, metadata, is_active, created_at, radius_m
      `;
      queryParams = [
        req.body.name,
        req.body.description || null,
        req.accountId,
        center.longitude,
        center.latitude,
        radius,
        req.body.type,
        JSON.stringify(req.body.metadata || {})
      ];
    } else if (req.body.type === 'polygon') {
      const coordinates = req.body.coordinates;
      // Create GeoJSON polygon format for PostGIS
      const geoJsonPolygon = {
        type: 'Polygon',
        coordinates: [[
          ...coordinates.map((coord: { longitude: number; latitude: number }) => [coord.longitude, coord.latitude]),
          [coordinates[0].longitude, coordinates[0].latitude] // Close the polygon
        ]]
      };
      
      queryText = `
        INSERT INTO geofences (name, description, account_id, geometry, geofence_type, metadata, radius_m)
        VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6, NULL)
        RETURNING id, name, description, geofence_type, ST_AsGeoJSON(geometry) as geometry_geojson, metadata, is_active, created_at, radius_m
      `;
      queryParams = [
        req.body.name,
        req.body.description || null,
        req.accountId,
        JSON.stringify(geoJsonPolygon),
        req.body.type,
        JSON.stringify(req.body.metadata || {})
      ];
    } else if (req.body.type === 'point') {
      const coord = req.body.coordinates[0];
      queryText = `
        INSERT INTO geofences (name, description, account_id, geometry, geofence_type, metadata, radius_m)
        VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, NULL)
        RETURNING id, name, description, geofence_type, ST_AsGeoJSON(geometry) as geometry_geojson, metadata, is_active, created_at, radius_m
      `;
      queryParams = [
        req.body.name,
        req.body.description || null,
        req.accountId,
        coord.longitude,
        coord.latitude,
        req.body.type,
        JSON.stringify(req.body.metadata || {})
      ];
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid geofence type'
      });
    }

    if (!queryText || queryParams.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid geofence data'
      });
    }

    const result = await query(queryText, queryParams);

    const geofence = {
      ...result.rows[0],
      geometry: JSON.parse(result.rows[0].geometry_geojson),
      geometry_geojson: undefined
    };

    res.status(201).json({
      success: true,
      data: geofence
    });
  } catch (error) {
    console.error('Error creating geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get specific geofence
router.get('/:geofenceId', requireAuth, requireAccount, async (req, res) => {
  try {
    const queryText = `
      SELECT 
        id,
        name,
        description,
        geofence_type,
        ST_AsGeoJSON(geometry) as geometry_geojson,
        metadata,
        is_active,
        created_at,
        updated_at
      FROM geofences 
      WHERE id = $1 AND account_id = $2
    `;

    const result = await query(queryText, [req.params.geofenceId, req.accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }

    const geofence = {
      ...result.rows[0],
      geometry: JSON.parse(result.rows[0].geometry_geojson),
      geometry_geojson: undefined
    };

    res.json({
      success: true,
      data: geofence
    });
  } catch (error) {
    console.error('Error fetching geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update geofence
router.put('/:geofenceId', requireAuth, requireAccount, validateBody(UpdateGeofenceSchema), async (req, res) => {
  try {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (req.body.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(req.body.name);
    }

    if (req.body.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(req.body.description);
    }

    if (req.body.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(req.body.is_active);
    }

    if (req.body.metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(req.body.metadata));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.geofenceId, req.accountId);

    const queryText = `
      UPDATE geofences 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++} AND account_id = $${paramCount}
      RETURNING id, name, description, geofence_type, ST_AsGeoJSON(geometry) as geometry_geojson, metadata, is_active, updated_at
    `;

    const result = await query(queryText, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }

    const geofence = {
      ...result.rows[0],
      geometry: JSON.parse(result.rows[0].geometry_geojson),
      geometry_geojson: undefined
    };

    res.json({
      success: true,
      data: geofence
    });
  } catch (error) {
    console.error('Error updating geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete geofence
router.delete('/:geofenceId', requireAuth, requireAccount, async (req, res) => {
  try {
    const queryText = 'DELETE FROM geofences WHERE id = $1 AND account_id = $2';
    const result = await query(queryText, [req.params.geofenceId, req.accountId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }

    res.json({
      success: true,
      message: 'Geofence deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Test if a location is inside the geofence
router.post('/:geofenceId/test', requireAuth, requireAccount, validateBody(TestLocationSchema), async (req, res) => {
  try {
    const queryText = `
      SELECT 
        ST_Contains(geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)) as is_inside,
        ST_Distance(geometry::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters
      FROM geofences 
      WHERE id = $3 AND account_id = $4
    `;

    const result = await query(queryText, [
      req.body.longitude,
      req.body.latitude,
      req.params.geofenceId,
      req.accountId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }

    const { is_inside, distance_meters } = result.rows[0];

    res.json({
      success: true,
      data: {
        location: {
          latitude: req.body.latitude,
          longitude: req.body.longitude
        },
        is_inside: is_inside,
        distance_meters: parseFloat(distance_meters)
      }
    });
  } catch (error) {
    console.error('Error testing geofence location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router as geofenceRoutes };
