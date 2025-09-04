import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db/client.js';
import { validateQuery, requireAccount } from '../middleware/validation.js';
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
router.get('/', requireAuth, requireAccount, validateQuery(EventsQuerySchema), async (req, res) => {
  try {
    const client = await getDbClient();
    const { limit, offset, device_id, geofence_id, event_type, from_date, to_date } = req.query as any;
    
    // For development, get the first available organization if no auth
    let accountId = req.accountId;
    
    if (!accountId) {
      const orgResult = await client.query('SELECT id FROM accounts ORDER BY created_at LIMIT 1');
      if (orgResult.rows.length > 0) {
        accountId = orgResult.rows[0].id;
      } else {
        return res.status(400).json({
          success: false,
          error: 'No organization found'
        });
      }
    }
    
    let whereClause = `
      WHERE ge.account_id = $1
    `;
    const values = [accountId];
    let paramCount = 2;
    
    if (device_id) {
      whereClause += ` AND ge.device_id = $${paramCount++}`;
      values.push(device_id);
    }
    
    if (geofence_id) {
      whereClause += ` AND ge.geofence_id = $${paramCount++}`;
      values.push(geofence_id);
    }
    
    if (event_type) {
      whereClause += ` AND ge.type = $${paramCount++}`;
      values.push(event_type);
    }
    
    if (from_date) {
      whereClause += ` AND ge.ts >= $${paramCount++}`;
      values.push(from_date);
    }
    
    if (to_date) {
      whereClause += ` AND ge.ts <= $${paramCount++}`;
      values.push(to_date);
    }
    
    const query = `
      SELECT 
        ge.id,
        ge.type as event_type,
        ge.device_id,
        ge.geofence_id,
        NULL as longitude,
        NULL as latitude,
        '{}' as metadata,
        ge.ts as timestamp,
        ge.ts as processed_at,
        d.name as device_name,
        g.name as geofence_name,
        COUNT(*) OVER() as total_count
      FROM geofence_events ge
      LEFT JOIN devices d ON ge.device_id = d.id
      LEFT JOIN geofences g ON ge.geofence_id = g.id
      ${whereClause}
      ORDER BY ge.ts DESC
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
router.get('/:eventId', requireAuth, requireAccount, async (req, res) => {
  try {
    const client = await getDbClient();
    const query = `
      SELECT 
        ge.id,
        ge.type as event_type,
        ge.device_id,
        ge.geofence_id,
        NULL as longitude,
        NULL as latitude,
        '{}' as metadata,
        ge.ts as timestamp,
        ge.ts as processed_at,
        d.name as device_name,
        d.device_key as device_token,
        g.name as geofence_name,
        ST_AsGeoJSON(g.geom) as geofence_geometry
      FROM geofence_events ge
      LEFT JOIN devices d ON ge.device_id = d.id
      LEFT JOIN geofences g ON ge.geofence_id = g.id
      WHERE ge.id = $1
      AND (d.account_id = $2 OR g.account_id = $2)
    `;
    
    const result = await client.query(query, [req.params.eventId, req.accountId]);
    
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
router.post('/:eventId/replay', requireAuth, requireAccount, async (req, res) => {
  try {
    const client = await getDbClient();
    
    // First, verify the event exists and belongs to the organization
    const eventQuery = `
      SELECT
        ge.id,
        ge.type as event_type,
        ge.device_id,
        ge.geofence_id,
        NULL as longitude,
        NULL as latitude,
        '{}' as metadata,
        ge.ts as timestamp,
        d.device_key as device_token
      FROM geofence_events ge
      JOIN devices d ON ge.device_id = d.id
      WHERE ge.id = $1 AND d.account_id = $2
    `;
    
    const eventResult = await client.query(eventQuery, [req.params.eventId, req.accountId]);
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    const event = eventResult.rows[0];
    
    // All events in geofence_events table are geofence events
    const triggerType = event.event_type;
    
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
    
    // Create a new geofence event record to indicate replay
    const replayQuery = `
      INSERT INTO geofence_events (type, device_id, geofence_id, ts, event_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const replayResult = await client.query(replayQuery, [
      event.event_type,
      event.device_id,
      event.geofence_id,
      replayEvent.timestamp,
      `replay_${event.id}_${Date.now()}`
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
router.get('/:eventId/executions', requireAuth, requireAccount, async (req, res) => {
  try {
    const client = await getDbClient();
    const query = `
      SELECT 
        d_exec.id,
        d_exec.status,
        '{}' as response_data,
        d_exec.last_error as error_message,
        d_exec.attempt as retry_count,
        d_exec.created_at as executed_at,
        d_exec.updated_at as completed_at,
        ar.name as rule_name,
        a.name as integration_name,
        a.kind as integration_type
      FROM deliveries d_exec
      JOIN automation_rules ar ON d_exec.rule_id = ar.id
      JOIN automations a ON d_exec.automation_id = a.id
      JOIN geofence_events ge ON d_exec.gevent_id = ge.id
      JOIN devices d ON ge.device_id = d.id
      WHERE d_exec.gevent_id = $1 AND d.account_id = $2
      ORDER BY d_exec.created_at DESC
    `;
    
    const result = await client.query(query, [req.params.eventId, req.accountId]);
    
    if (result.rows.length === 0) {
      // Check if the event exists at all
      const eventExistsQuery = `
        SELECT ge.id
        FROM geofence_events ge
        JOIN devices d ON ge.device_id = d.id
        WHERE ge.id = $1 AND d.account_id = $2
      `;
      const eventExists = await client.query(eventExistsQuery, [req.params.eventId, req.accountId]);
      
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
