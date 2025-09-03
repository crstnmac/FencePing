import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db/client.js';
import { validateQuery, requireOrganization } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { getKafkaProducer } from '../kafka/producer.js';

const router = Router();

const EventsQuerySchema = z.object({
  limit: z.string().pipe(z.coerce.number().min(1).max(100)).default('50'),
  offset: z.string().pipe(z.coerce.number().min(0)).default('0'),
  device_id: z.string().uuid().optional(),
  geofence_id: z.string().uuid().optional(),
  event_type: z.string().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional()
});

// Get events with filtering and pagination
router.get('/', requireAuth, requireOrganization, validateQuery(EventsQuerySchema), async (req, res) => {
  try {
    const client = await getDbClient();
    const { limit, offset, device_id, geofence_id, event_type, from_date, to_date } = req.query as any;
    
    // For development, get the first available organization if no auth
    let organizationId = req.organizationId;
    
    if (!organizationId) {
      const orgResult = await client.query('SELECT id FROM organizations ORDER BY created_at LIMIT 1');
      if (orgResult.rows.length > 0) {
        organizationId = orgResult.rows[0].id;
      } else {
        return res.status(400).json({
          success: false,
          error: 'No organization found'
        });
      }
    }
    
    let whereClause = `
      WHERE d.account_id = $1
    `;
    const values = [organizationId];
    let paramCount = 2;
    
    if (device_id) {
      whereClause += ` AND e.device_id = $${paramCount++}`;
      values.push(device_id);
    }
    
    if (geofence_id) {
      whereClause += ` AND e.geofence_id = $${paramCount++}`;
      values.push(geofence_id);
    }
    
    if (event_type) {
      whereClause += ` AND e.event_type = $${paramCount++}`;
      values.push(event_type);
    }
    
    if (from_date) {
      whereClause += ` AND e.timestamp >= $${paramCount++}`;
      values.push(from_date);
    }
    
    if (to_date) {
      whereClause += ` AND e.timestamp <= $${paramCount++}`;
      values.push(to_date);
    }
    
    const query = `
      SELECT 
        e.id,
        e.event_type,
        e.device_id,
        e.geofence_id,
        ST_X(e.location) as longitude,
        ST_Y(e.location) as latitude,
        e.metadata,
        e.timestamp,
        e.processed_at,
        d.name as device_name,
        g.name as geofence_name,
        COUNT(*) OVER() as total_count
      FROM events e
      LEFT JOIN devices d ON e.device_id = d.id
      LEFT JOIN geofences g ON e.geofence_id = g.id
      ${whereClause}
      ORDER BY e.timestamp DESC
      LIMIT $${paramCount++}
      OFFSET $${paramCount}
    `;
    
    values.push(limit, offset);
    const result = await client.query(query, values);
    
    const events = result.rows.map(row => ({
      id: row.id,
      event_type: row.event_type,
      device: row.device_id ? {
        id: row.device_id,
        name: row.device_name
      } : null,
      geofence: row.geofence_id ? {
        id: row.geofence_id,
        name: row.geofence_name
      } : null,
      location: row.longitude && row.latitude ? {
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude)
      } : null,
      metadata: row.metadata,
      timestamp: row.timestamp,
      processed_at: row.processed_at
    }));
    
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    
    res.json({
      success: true,
      data: events,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: totalCount > (parseInt(offset) + events.length)
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get specific event
router.get('/:eventId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    const query = `
      SELECT 
        e.id,
        e.event_type,
        e.device_id,
        e.geofence_id,
        ST_X(e.location) as longitude,
        ST_Y(e.location) as latitude,
        e.metadata,
        e.timestamp,
        e.processed_at,
        d.name as device_name,
        d.device_token,
        g.name as geofence_name,
        ST_AsGeoJSON(g.geometry) as geofence_geometry
      FROM events e
      LEFT JOIN devices d ON e.device_id = d.id
      LEFT JOIN geofences g ON e.geofence_id = g.id
      WHERE e.id = $1
      AND (d.account_id = $2 OR g.account_id = $2)
    `;
    
    const result = await client.query(query, [req.params.eventId, req.organizationId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    const row = result.rows[0];
    const event = {
      id: row.id,
      event_type: row.event_type,
      device: row.device_id ? {
        id: row.device_id,
        name: row.device_name,
        device_token: row.device_token
      } : null,
      geofence: row.geofence_id ? {
        id: row.geofence_id,
        name: row.geofence_name,
        geometry: row.geofence_geometry ? JSON.parse(row.geofence_geometry) : null
      } : null,
      location: row.longitude && row.latitude ? {
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude)
      } : null,
      metadata: row.metadata,
      timestamp: row.timestamp,
      processed_at: row.processed_at
    };
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Replay event (trigger automation processing again)
// Replay event (trigger automation processing again)
router.post('/:eventId/replay', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    
    // First, verify the event exists and belongs to the organization
    const eventQuery = `
      SELECT
        e.id,
        e.event_type,
        e.device_id,
        e.geofence_id,
        ST_X(e.location) as longitude,
        ST_Y(e.location) as latitude,
        e.metadata,
        e.timestamp,
        d.device_token
      FROM events e
      JOIN devices d ON e.device_id = d.id
      WHERE e.id = $1 AND d.account_id = $2
    `;
    
    const eventResult = await client.query(eventQuery, [req.params.eventId, req.organizationId]);
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    const event = eventResult.rows[0];
    
    // Check if this is a geofence event that can be replayed
    if (!event.event_type.startsWith('geofence_')) {
      return res.status(400).json({
        success: false,
        error: 'Only geofence events can be replayed'
      });
    }
    
    // Extract the trigger type from event_type (e.g., "geofence_enter" -> "enter")
    const triggerType = event.event_type.replace('geofence_', '');
    
    // Create a synthetic geofence event for replay
    const replayEvent = {
      type: triggerType,
      deviceId: event.device_token,
      geofenceId: event.geofence_id,
      location: {
        latitude: parseFloat(event.latitude),
        longitude: parseFloat(event.longitude)
      },
      timestamp: new Date().toISOString(),
      metadata: {
        ...event.metadata,
        replayed_from: event.id,
        replayed_at: new Date().toISOString(),
        original_timestamp: event.timestamp
      }
    };
    
    // Publish event replay to Kafka for processing by automation workers
    try {
      const kafkaProducer = getKafkaProducer();
      await kafkaProducer.publishEventReplay([replayEvent]);
    } catch (kafkaError) {
      console.error('Error publishing event replay to Kafka:', kafkaError);
      // Don't fail the request if Kafka publishing fails, just log it
    }
    
    // For now, we'll just create a new event record to indicate replay
    const replayQuery = `
      INSERT INTO events (event_type, device_id, geofence_id, location, metadata, timestamp, processed_at)
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, NOW())
      RETURNING id
    `;
    
    const replayResult = await client.query(replayQuery, [
      `${event.event_type}_replay`,
      event.device_id,
      event.geofence_id,
      replayEvent.location.longitude,
      replayEvent.location.latitude,
      JSON.stringify(replayEvent.metadata),
      replayEvent.timestamp
    ]);
    
    res.json({
      success: true,
      message: 'Event replay initiated',
      data: {
        original_event_id: req.params.eventId,
        replay_event_id: replayResult.rows[0].id,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error replaying event:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get automation execution history for events
// Get automation execution history for events
router.get('/:eventId/executions', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    const query = `
      SELECT 
        ae.id,
        ae.status,
        ae.response_data,
        ae.error_message,
        ae.retry_count,
        ae.executed_at,
        ae.completed_at,
        ar.name as rule_name,
        i.name as integration_name,
        i.type as integration_type
      FROM automation_executions ae
      JOIN automation_rules ar ON ae.automation_rule_id = ar.id
      JOIN integrations i ON ar.integration_id = i.id
      JOIN events e ON ae.event_id = e.id
      JOIN devices d ON e.device_id = d.id
      WHERE ae.event_id = $1 AND d.account_id = $2
      ORDER BY ae.executed_at DESC
    `;
    
    const result = await client.query(query, [req.params.eventId, req.organizationId]);
    
    if (result.rows.length === 0) {
      // Check if the event exists at all
      const eventExistsQuery = `
        SELECT e.id
        FROM events e
        JOIN devices d ON e.device_id = d.id
        WHERE e.id = $1 AND d.account_id = $2
      `;
      const eventExists = await client.query(eventExistsQuery, [req.params.eventId, req.organizationId]);
      
      if (eventExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }
    }
    
    const executions = result.rows.map(row => ({
      id: row.id,
      status: row.status,
      response_data: row.response_data,
      error_message: row.error_message,
      retry_count: row.retry_count,
      executed_at: row.executed_at,
      completed_at: row.completed_at,
      rule: {
        name: row.rule_name
      },
      integration: {
        name: row.integration_name,
        type: row.integration_type
      }
    }));
    
    res.json({
      success: true,
      data: executions,
      total: executions.length
    });
  } catch (error) {
    console.error('Error fetching event executions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router as eventRoutes };
