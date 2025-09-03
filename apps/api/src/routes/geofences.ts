import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db/client.js';
import { validateBody, requireOrganization } from '../middleware/validation.js';
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

const CreateGeofenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('circle') }).merge(CreateCircleGeofenceSchema),
  z.object({ type: z.literal('polygon') }).merge(CreatePolygonGeofenceSchema)
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
router.get('/', requireAuth, requireOrganization, async (req, res) => {
  const client = await getDbClient();
  try {
    const query = `
      SELECT
        id,
        name,
        ST_AsGeoJSON(geom) as geometry_geojson,
        properties,
        active,
        created_at,
        type,
        radius_m
      FROM geofences
      WHERE account_id = $1
      ORDER BY created_at DESC
    `;

    // For development, get the first available account if no auth
    let accountId = req.accountId;

    if (!accountId) {
      const accountResult = await client.query('SELECT id FROM accounts ORDER BY created_at LIMIT 1');
      if (accountResult.rows.length > 0) {
        accountId = accountResult.rows[0].id;
      } else {
        return res.status(400).json({
          success: false,
          error: 'No account found'
        });
      }
    }

    const result = await client.query(query, [accountId]);

    const geofences = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      geometry: JSON.parse(row.geometry_geojson),
      properties: row.properties,
      active: row.active,
      created_at: row.created_at,
      type: row.type,
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
  } finally {
    if (client) {
      await client.end();
    }
  }
});

// Create new geofence
router.post('/', requireAuth, requireOrganization, validateBody(CreateGeofenceSchema), async (req, res) => {
  try {
    const client = await getDbClient();
    let geometryWKT: string;

    if (req.body.type === 'circle') {
      const { center, radius } = req.body;
      geometryWKT = `ST_Buffer(ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography, ${radius})::geometry`;
    } else {
      const coordinatePoints = req.body.coordinates.map((coord: { longitude: any; latitude: any; }) => `ST_MakePoint(${coord.longitude}, ${coord.latitude})`).join(', ');
      geometryWKT = `ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[${coordinatePoints}, ST_MakePoint(${req.body.coordinates[0].longitude}, ${req.body.coordinates[0].latitude})])), 4326)`;
    }

    const query = `
      INSERT INTO geofences (name, description, organization_id, geometry, geofence_type, metadata)
      VALUES ($1, $2, $3, ${geometryWKT}, $4, $5)
      RETURNING id, name, description, geofence_type, ST_AsGeoJSON(geometry) as geometry_geojson, metadata, is_active, created_at
    `;

    const result = await client.query(query, [
      req.body.name,
      req.body.description || null,
      req.organizationId,
      req.body.type,
      JSON.stringify(req.body.metadata || {})
    ]);

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
router.get('/:geofenceId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    const query = `
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
      WHERE id = $1 AND organization_id = $2
    `;

    const result = await client.query(query, [req.params.geofenceId, req.organizationId]);

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
router.put('/:geofenceId', requireAuth, requireOrganization, validateBody(UpdateGeofenceSchema), async (req, res) => {
  try {
    const client = await getDbClient();
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
    values.push(req.params.geofenceId, req.organizationId);

    const query = `
      UPDATE geofences 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++} AND organization_id = $${paramCount}
      RETURNING id, name, description, geofence_type, ST_AsGeoJSON(geometry) as geometry_geojson, metadata, is_active, updated_at
    `;

    const result = await client.query(query, values);

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
router.delete('/:geofenceId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    const query = 'DELETE FROM geofences WHERE id = $1 AND organization_id = $2';
    const result = await client.query(query, [req.params.geofenceId, req.organizationId]);

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
router.post('/:geofenceId/test', requireAuth, requireOrganization, validateBody(TestLocationSchema), async (req, res) => {
  try {
    const client = await getDbClient();
    const query = `
      SELECT 
        ST_Contains(geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)) as is_inside,
        ST_Distance(geometry::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters
      FROM geofences 
      WHERE id = $3 AND organization_id = $4
    `;

    const result = await client.query(query, [
      req.body.longitude,
      req.body.latitude,
      req.params.geofenceId,
      req.organizationId
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
