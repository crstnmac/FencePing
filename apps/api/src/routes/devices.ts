import { Router } from 'express';
import { z } from 'zod';
import { getDbClient, query, queryWithTimeout } from '../db/client.js';
import { validateBody } from '../middleware/validation.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { 
  requireDeviceAuth, 
  requireDevicePermission, 
  requireDeviceOwnership,
  AuthenticatedRequest 
} from '../middleware/deviceAuth.js';
import { 
  deviceRateLimit, 
  accountRateLimit, 
  rateLimitPresets 
} from '../middleware/rateLimiting.js';
import { randomBytes } from 'crypto';
import { getKafkaProducer } from '../kafka/producer.js';
import {
  generateDeviceTokens,
  completeDevicePairing,
  cleanupExpiredPairingRequests,
  DeviceRegistrationSchema,
  DevicePairingSchema
} from '../utils/deviceAuth.js';

const router = Router();

const CreateDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  meta: z.record(z.any()).optional()
});

const UpdateDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  meta: z.record(z.any()).optional(),
  device_type: z.string().max(50).optional(),
  is_active: z.boolean().optional()
});

const LocationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  altitude: z.number().optional(),
  timestamp: z.string().datetime().optional()
});

// Get all devices for account with pagination
router.get('/', optionalAuth, requireAuth, async (req, res) => {
  try {
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

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500); // Max 500 devices per page
    const offset = (page - 1) * limit;

    // Check if we should return just count for performance
    const countOnly = req.query.count === 'true';

    if (countOnly) {
      // Simple count query with timeout
      const countQuery = `
        SELECT COUNT(*) as total
        FROM devices
        WHERE account_id = $1
      `;
      const countResult = await queryWithTimeout(countQuery, [accountId], 15000);
      return res.json({
        success: true,
        total: parseInt(countResult.rows[0].total),
        pages: null,
        page: null,
        limit: null
      });
    }

    // Get devices with pagination and timeout
    const queryText = `
      SELECT
        id,
        name,
        device_key,
        meta,
        created_at
      FROM devices
      WHERE account_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await queryWithTimeout(queryText, [accountId, limit, offset], 30000);

    // Get total count for pagination info (with timeout)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM devices
      WHERE account_id = $1
    `;
    const countResult = await queryWithTimeout(countQuery, [accountId], 15000);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching devices:', error);

    // Provide specific timeout error message
    if (error && typeof error === 'object' && 'message' in error) {
      const err = error as { message: string };
      if (err.message?.includes('timeout')) {
        return res.status(408).json({
          success: false,
          error: 'Request timeout - too many devices or slow database connection'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new device
router.post('/',requireAuth, validateBody(CreateDeviceSchema), async (req, res) => {
  try {
    const deviceToken = randomBytes(32).toString('hex');

    const queryText = `
      INSERT INTO devices (name, meta, account_id, device_key)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, meta, device_key, created_at
    `;

    const result = await query(queryText, [
      req.body.name,
      req.body.meta || {},
      req.accountId,
      deviceToken
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Bulk device operations

const BulkCreateDeviceSchema = z.object({
  devices: z.array(CreateDeviceSchema).min(1).max(100)
});

const BulkUpdateDeviceSchema = z.object({
  deviceIds: z.array(z.string().uuid()).min(1).max(100),
  updates: UpdateDeviceSchema
});

const BulkDeleteDeviceSchema = z.object({
  deviceIds: z.array(z.string().uuid()).min(1).max(100)
});

// Bulk create devices
router.post('/bulk', requireAuth, validateBody(BulkCreateDeviceSchema), async (req, res) => {
  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const createdDevices = [];
    const errors = [];

    for (let i = 0; i < req.body.devices.length; i++) {
      try {
        const deviceData = req.body.devices[i];
        const deviceToken = randomBytes(32).toString('hex');

        const result = await client.query(
          `INSERT INTO devices (name, meta, account_id, device_key)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, meta, device_key, created_at`,
          [
            deviceData.name,
            deviceData.meta || {},
            req.accountId,
            deviceToken
          ]
        );

        createdDevices.push(result.rows[0]);
      } catch (error) {
        errors.push({
          index: i,
          device: req.body.devices[i],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Only rollback if all devices failed (maintain consistency)
    if (errors.length > 0 && createdDevices.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'All devices failed to create',
        errors
      });
    }

    // Commit if at least one device was created successfully
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        created: createdDevices,
        failed: errors,
        summary: {
          total: req.body.devices.length,
          created: createdDevices.length,
          failed: errors.length
        }
      }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error bulk creating devices:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Bulk update devices
router.put('/bulk', requireAuth, validateBody(BulkUpdateDeviceSchema), async (req, res) => {
  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (req.body.updates.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(req.body.updates.name);
    }

    if (req.body.updates.meta !== undefined) {
      updates.push(`meta = $${paramCount++}`);
      values.push(req.body.updates.meta);
    }

    if (req.body.updates.device_type !== undefined) {
      updates.push(`device_type = $${paramCount++}`);
      values.push(req.body.updates.device_type);
    }

    if (req.body.updates.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(req.body.updates.is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }

    updates.push(`updated_at = NOW()`);

    // Create placeholders for device IDs
    const devicePlaceholders = req.body.deviceIds.map((_: any, index: number) => `$${paramCount + index}`).join(',');
    values.push(...req.body.deviceIds);
    values.push(req.accountId);

    const queryText = `
      UPDATE devices
      SET ${updates.join(', ')}
      WHERE id IN (${devicePlaceholders}) AND account_id = $${paramCount + req.body.deviceIds.length}
      RETURNING id, name, meta, updated_at
    `;

    const result = await client.query(queryText, values);

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        updated: result.rows,
        summary: {
          requested: req.body.deviceIds.length,
          updated: result.rowCount
        }
      }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error bulk updating devices:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Bulk delete devices
router.delete('/bulk', requireAuth, validateBody(BulkDeleteDeviceSchema), async (req, res) => {
  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    // Create placeholders for device IDs
    const devicePlaceholders = req.body.deviceIds.map((_: any, index: number) => `$${index + 1}`).join(',');
    const values = [...req.body.deviceIds, req.accountId];

    const queryText = `
      DELETE FROM devices
      WHERE id IN (${devicePlaceholders}) AND account_id = $${req.body.deviceIds.length + 1}
      RETURNING id, name
    `;

    const result = await client.query(queryText, values);

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        deleted: result.rows,
        summary: {
          requested: req.body.deviceIds.length,
          deleted: result.rowCount
        }
      }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error bulk deleting devices:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Get specific device
router.get('/:deviceId', requireAuth, async (req, res) => {
  try {
    const queryText = `
      SELECT
        id,
        name,
        meta,
        device_key,
        created_at
      FROM devices
      WHERE id = $1 AND account_id = $2
    `;

    const result = await query(queryText, [req.params.deviceId, req.accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update device
router.put('/:deviceId', requireAuth, validateBody(UpdateDeviceSchema), async (req, res) => {
  try {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (req.body.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(req.body.name);
    }

    if (req.body.meta !== undefined) {
      updates.push(`meta = $${paramCount++}`);
      values.push(req.body.meta);
    }

    if (req.body.device_type !== undefined) {
      updates.push(`device_type = $${paramCount++}`);
      values.push(req.body.device_type);
    }

    if (req.body.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(req.body.is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.deviceId, req.accountId);

    const queryText = `
      UPDATE devices
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++} AND account_id = $${paramCount}
      RETURNING id, name, meta, updated_at
    `;

    const result = await query(queryText, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete device
router.delete('/:deviceId', requireAuth, async (req, res) => {
  try {
    const queryText = 'DELETE FROM devices WHERE id = $1 AND account_id = $2';
    const result = await query(queryText, [req.params.deviceId, req.accountId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update device location (REST API fallback for MQTT)
router.post('/:deviceId/location', 
  deviceRateLimit(rateLimitPresets.locationUpdates),
  validateBody(LocationUpdateSchema), 
  async (req, res) => {
  try {
    const timestamp = req.body.timestamp || new Date().toISOString();

    const queryText = `
      UPDATE devices
      SET
        last_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
        last_seen = $3,
        updated_at = NOW()
      WHERE id = $4
    `;

    const result = await query(queryText, [
      req.body.longitude,
      req.body.latitude,
      timestamp,
      req.params.deviceId
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Publish location event to Kafka for processing by geofence engine
    try {
      const kafkaProducer = getKafkaProducer();
      await kafkaProducer.publishLocationEvent({
        deviceId: req.params.deviceId,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        accuracy: req.body.accuracy,
        altitude: req.body.altitude,
        timestamp: timestamp
      });
    } catch (kafkaError) {
      console.error('Error publishing to Kafka:', kafkaError);
      // Don't fail the request if Kafka publishing fails, just log it
    }

    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Error updating device location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Device Pairing Endpoints

// Generate pairing code for device setup
router.post('/pairing/generate', 
  optionalAuth, 
  accountRateLimit(rateLimitPresets.pairing),
  async (req, res) => {
  try {
    console.log('Generating pairing code - starting...');
    const client = await getDbClient();
    console.log('Database client connected');

    // For development/testing, get first available account if not set
    let accountId = req.accountId;

    console.log(`Initial values - accountId: ${accountId}`);

    if (!accountId) {
      const accountResult = await client.query('SELECT id, name FROM accounts ORDER BY created_at LIMIT 1');
      console.log('Account query result:', accountResult.rows);
      if (accountResult.rows.length > 0) {
        accountId = accountResult.rows[0].id;
        console.log(`Using found account: ${accountId}`);
      } else {
        console.log('No accounts found in database');
        return res.status(400).json({
          success: false,
          error: 'No account found. Please ensure you have at least one account in the system.'
        });
      }
    }

    console.log(`Using accountId: ${accountId}`);

    if (!accountId) {
      const orgResult = await client.query('SELECT id, name FROM accounts ORDER BY created_at LIMIT 1');
      console.log('Organization query result:', orgResult.rows);
      if (orgResult.rows.length > 0) {
        accountId = orgResult.rows[0].id;
        console.log(`Using found organization: ${accountId}`);
      } else {
        // Try to create a default organization if none exist
        console.log('No accounts found, attempting to create default');
        try {
          const defaultOrgResult = await client.query(
            'INSERT INTO accounts (name, owner_id) VALUES ($1, (SELECT id FROM users ORDER BY created_at LIMIT 1)) RETURNING id',
            ['Default Organization']
          );
          if (defaultOrgResult.rows.length > 0) {
            accountId = defaultOrgResult.rows[0].id;
            console.log(`Created default organization: ${accountId}`);
          } else {
            // Fallback: set accountId to null
            accountId = undefined;
            console.log('Failed to create default organization, setting to null');
          }
        } catch (orgCreateError) {
          console.error('Failed to create default organization:', orgCreateError);
          accountId = undefined;
        }
      }
    }

    console.log(`Using accountId: ${accountId}`);

    // Generate unique pairing code (10 alphanumeric characters)
    const pairingCode = Array.from({length: 10}, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
    ).join('');
    console.log(`Generated pairing code: ${pairingCode}`);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    console.log(`Expires at: ${expiresAt.toISOString()}`);

    // Get or create a user for pairing creation (for development/anonymous pairing)
    let createdBy = req.user?.id;

    if (!createdBy) {
      // For development/testing, get first available user
      const userResult = await client.query('SELECT id FROM users ORDER BY created_at LIMIT 1');
      if (userResult.rows.length > 0) {
        createdBy = userResult.rows[0].id;
        console.log(`Using found user for pairing creation: ${createdBy}`);
      } else {
        console.log('No users found in database, cannot create pairing request');
        return res.status(400).json({
          success: false,
          error: 'No users found. Please ensure you have at least one user in the system.'
        });
      }
    }

    // Create pairing request
    const result = await client.query(
      `INSERT INTO device_pairing_requests (
        pairing_code, account_id, expires_at, created_by, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, pairing_code, expires_at`,
      [pairingCode, accountId, expiresAt.toISOString(), createdBy]
    );
    console.log('Pairing request created:', result.rows[0]);

    res.status(201).json({
      success: true,
      data: {
        pairingCode: result.rows[0].pairing_code,
        expiresAt: result.rows[0].expires_at,
        pairingUrl: `device://pair?code=${pairingCode}` // Format for mobile/desktop apps
      }
    });
  } catch (error) {
    console.error('Detailed error generating pairing code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate pairing code',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Complete device pairing using pairing code
router.post('/pairing/complete', 
  accountRateLimit(rateLimitPresets.pairing),
  validateBody(DevicePairingSchema), 
  async (req, res) => {
  try {
    const pairingResult = await completeDevicePairing(
      req.body.pairingCode,
      req.body.deviceData
    );

    if (!pairingResult) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired pairing code'
      });
    }

    res.json({
      success: true,
      data: pairingResult
    });
  } catch (error) {
    console.error('Error completing device pairing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete device pairing'
    });
  }
});

// Get device status and heartbeat
router.get('/:deviceId/status', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    const result = await client.query(
      `SELECT id, name, status, last_heartbeat, health_metrics, capabilities,
              connection_type, ip_address, mac_address, device_model,
              device_firmware_version, device_os, is_paired,
              EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) as seconds_since_heartbeat
       FROM devices
       WHERE id = $1 AND account_id = $2`,
      [req.params.deviceId, req.accountId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const device = result.rows[0];
    const isOnline = device.seconds_since_heartbeat < 300; // 5 minutes

    res.json({
      success: true,
      data: {
        deviceId: device.id,
        name: device.name,
        status: isOnline ? 'online' : 'offline',
        lastHeartbeat: device.last_heartbeat,
        healthMetrics: device.health_metrics,
        capabilities: device.capabilities,
        connectionType: device.connection_type,
        ipAddress: device.ip_address,
        macAddress: device.mac_address,
        deviceModel: device.device_model,
        firmwareVersion: device.device_firmware_version,
        deviceOs: device.device_os,
        isPaired: device.is_paired,
        secondsSinceHeartbeat: device.seconds_since_heartbeat
      }
    });
  } catch (error) {
    console.error('Error fetching device status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get device location history
router.get('/:deviceId/locations', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    
    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = (page - 1) * limit;
    
    // Date filtering
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    
    let whereClause = 'WHERE device_id = $1';
    let params = [req.params.deviceId];
    let paramCount = 2;
    
    if (startDate) {
      whereClause += ` AND timestamp >= $${paramCount++}`;
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ` AND timestamp <= $${paramCount++}`;
      params.push(endDate);
    }
    
    // Get location history from events table
    const result = await client.query(
      `SELECT 
         id,
         ST_X(location) as longitude,
         ST_Y(location) as latitude,
         timestamp,
         metadata
       FROM events
       ${whereClause}
       AND event_type = 'location_update'
       ORDER BY timestamp DESC
       LIMIT $${paramCount++} OFFSET $${paramCount}`,
      [...params, limit, offset]
    );
    
    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total
       FROM events
       ${whereClause}
       AND event_type = 'location_update'`,
      params.slice(0, -2) // Remove limit and offset
    );
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching device location history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Device heartbeat endpoint
router.post('/:deviceId/heartbeat', async (req, res) => {
  try {
    const client = await getDbClient();
    const heartbeatData = req.body;

    const result = await client.query(
      `UPDATE devices SET
         last_heartbeat = NOW(),
         health_metrics = COALESCE(health_metrics, '{}')::jsonb || $2::jsonb,
         connection_type = COALESCE($3, connection_type),
         ip_address = COALESCE($4, ip_address),
         mac_address = COALESCE($5, mac_address),
         status = 'online',
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, status`,
      [
        req.params.deviceId,
        JSON.stringify(heartbeatData || {}),
        heartbeatData?.connectionType,
        req.ip,
        heartbeatData?.macAddress
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Update device heartbeats table
    await client.query(
      `INSERT INTO device_heartbeats (
        device_id, battery_level, connection_strength,
        uptime_seconds, metadata, timestamp
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        req.params.deviceId,
        heartbeatData?.batteryPct,
        heartbeatData?.signalStrength,
        heartbeatData?.uptimeSeconds,
        JSON.stringify(heartbeatData || {})
      ]
    );

    res.json({
      success: true,
      message: 'Heartbeat received successfully'
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process heartbeat'
    });
  }
});

// Device command endpoints

const DeviceCommandSchema = z.object({
  command: z.enum(['restart', 'update_config', 'ping', 'get_status', 'update_firmware', 'factory_reset']),
  parameters: z.record(z.any()).optional(),
  timeout: z.number().min(1).max(300).optional() // seconds
});

// Send command to device
router.post('/:deviceId/commands', 
  requireAuth, 
  deviceRateLimit(rateLimitPresets.deviceCommands),
  validateBody(DeviceCommandSchema), 
  async (req, res) => {
  try {
    const client = await getDbClient();
    const commandId = randomBytes(16).toString('hex');
    
    // Verify device exists and user has permission
    const deviceResult = await client.query(
      `SELECT id, name, status FROM devices WHERE id = $1 AND account_id = $2`,
      [req.params.deviceId, req.accountId]
    );
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    if (device.status !== 'online') {
      return res.status(400).json({
        success: false,
        error: 'Device is not online'
      });
    }
    
    // Store command in database
    await client.query(
      `INSERT INTO device_commands (
        id, device_id, command, parameters, status, timeout_seconds, created_at
      ) VALUES ($1, $2, $3, $4, 'pending', $5, NOW())`,
      [
        commandId,
        req.params.deviceId,
        req.body.command,
        JSON.stringify(req.body.parameters || {}),
        req.body.timeout || 30
      ]
    );
    
    // Log command event
    await client.query(
      `INSERT INTO device_events (device_id, event_type, data, created_at)
       VALUES ($1, 'command_sent', $2, NOW())`,
      [
        req.params.deviceId,
        JSON.stringify({
          commandId,
          command: req.body.command,
          parameters: req.body.parameters
        })
      ]
    );
    
    // In a real implementation, you would publish this to MQTT or WebSocket
    // For now, we'll just return the command ID
    
    res.status(201).json({
      success: true,
      data: {
        commandId,
        command: req.body.command,
        status: 'pending',
        timeout: req.body.timeout || 30
      }
    });
  } catch (error) {
    console.error('Error sending device command:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send command'
    });
  }
});

// Get command status
router.get('/:deviceId/commands/:commandId', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    const result = await client.query(
      `SELECT dc.*, d.name as device_name
       FROM device_commands dc
       JOIN devices d ON dc.device_id = d.id
       WHERE dc.id = $1 AND dc.device_id = $2 AND d.account_id = $3`,
      [req.params.commandId, req.params.deviceId, req.accountId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Command not found'
      });
    }
    
    const command = result.rows[0];
    res.json({
      success: true,
      data: {
        commandId: command.id,
        command: command.command,
        parameters: command.parameters,
        status: command.status,
        response: command.response,
        error: command.error_message,
        createdAt: command.created_at,
        completedAt: command.completed_at,
        timeout: command.timeout_seconds
      }
    });
  } catch (error) {
    console.error('Error fetching command status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// List device commands
router.get('/:deviceId/commands', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;
    
    const result = await client.query(
      `SELECT 
         id, command, parameters, status, response, error_message,
         created_at, completed_at, timeout_seconds
       FROM device_commands dc
       JOIN devices d ON dc.device_id = d.id
       WHERE dc.device_id = $1 AND d.account_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.params.deviceId, req.accountId, limit, offset]
    );
    
    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total
       FROM device_commands dc
       JOIN devices d ON dc.device_id = d.id
       WHERE dc.device_id = $1 AND d.account_id = $2`,
      [req.params.deviceId, req.accountId]
    );
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching device commands:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Device sharing endpoints

// Share device with another user
router.post('/:deviceId/share', requireAuth,
  validateBody(z.object({
    targetUserId: z.string().uuid(),
    permissions: z.enum(['read', 'write', 'admin'])
  })), async (req, res) => {
  try {
    const client = await getDbClient();

    // Check if current user has admin permission on the device
    const permissionCheck = await client.query(
      `SELECT permissions FROM device_users
       WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user?.id]
    );

    const userPermissions = permissionCheck.rows[0]?.permissions;
    if (!userPermissions || !['admin', 'owner'].includes(userPermissions)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to share device'
      });
    }

    // Share device
    await client.query(
      `INSERT INTO device_users (device_id, user_id, permissions, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (device_id, user_id) DO UPDATE SET
         permissions = EXCLUDED.permissions,
         granted_by = EXCLUDED.granted_by`,
      [
        req.params.deviceId,
        req.body.targetUserId,
        req.body.permissions,
        req.user?.id
      ]
    );

    res.json({
      success: true,
      message: 'Device shared successfully'
    });
  } catch (error) {
    console.error('Error sharing device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share device'
    });
  }
});

// Get device users (who has access)
router.get('/:deviceId/users', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    const result = await client.query(
      `SELECT du.user_id, du.permissions, du.granted_at,
              u.name, u.email
       FROM device_users du
       JOIN users u ON du.user_id = u.id
       WHERE du.device_id = $1`,
      [req.params.deviceId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching device users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Periodic cleanup of expired pairing requests
router.post('/pairing/cleanup', requireAuth, async (req, res) => {
  try {
    const cleanedCount = await cleanupExpiredPairingRequests();
    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired pairing requests`
    });
  } catch (error) {
    console.error('Error cleaning up pairing requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up pairing requests'
    });
  }
});

// Device tagging schema
const DeviceTagSchema = z.object({
  tag: z.string().min(1).max(100),
  value: z.string().max(255).optional()
});

// Assign device to group
router.put('/:deviceId/group', requireAuth, validateBody(z.object({
  groupId: z.string().uuid()
})), async (req, res) => {
  try {
    const client = await getDbClient();
    
    // Verify group exists and belongs to account
    const groupResult = await client.query(
      `SELECT id FROM device_groups WHERE id = $1 AND account_id = $2`,
      [req.body.groupId, req.accountId]
    );
    
    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device group not found'
      });
    }
    
    const result = await client.query(
      `UPDATE devices SET group_id = $1
       WHERE id = $2 AND account_id = $3
       RETURNING id, name, group_id`,
      [req.body.groupId, req.params.deviceId, req.accountId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error assigning device to group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Device tagging endpoints

// Add tag to device
router.post('/:deviceId/tags', requireAuth, validateBody(DeviceTagSchema), async (req, res) => {
  try {
    const client = await getDbClient();
    
    // Verify device exists and belongs to account
    const deviceResult = await client.query(
      `SELECT id FROM devices WHERE id = $1 AND account_id = $2`,
      [req.params.deviceId, req.accountId]
    );
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    const result = await client.query(
      `INSERT INTO device_tags (device_id, tag, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_id, tag) DO UPDATE SET
         value = EXCLUDED.value,
         created_at = NOW()
       RETURNING id, tag, value, created_at`,
      [req.params.deviceId, req.body.tag, req.body.value]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding device tag:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get device tags
router.get('/:deviceId/tags', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    
    const result = await client.query(
      `SELECT dt.tag, dt.value, dt.created_at
       FROM device_tags dt
       JOIN devices d ON dt.device_id = d.id
       WHERE dt.device_id = $1 AND d.account_id = $2
       ORDER BY dt.tag`,
      [req.params.deviceId, req.accountId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching device tags:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Remove device tag
router.delete('/:deviceId/tags/:tag', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    
    const result = await client.query(
      `DELETE FROM device_tags
       USING devices d
       WHERE device_tags.device_id = d.id
       AND device_tags.device_id = $1
       AND device_tags.tag = $2
       AND d.account_id = $3
       RETURNING device_tags.tag`,
      [req.params.deviceId, req.params.tag, req.accountId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Tag removed successfully'
    });
  } catch (error) {
    console.error('Error removing device tag:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Device certificate management endpoints

// Generate certificate for device
router.post('/:deviceId/certificates', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    
    // Verify device exists and user has permission
    const deviceResult = await client.query(
      `SELECT id, name FROM devices WHERE id = $1 AND account_id = $2`,
      [req.params.deviceId, req.accountId]
    );
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    // In a real implementation, you would generate actual certificates
    // For now, we'll create placeholder certificate data
    const certificateSerial = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year
    
    const result = await client.query(
      `INSERT INTO device_certificates (
        device_id, certificate_serial, certificate_pem, private_key_pem, expires_at
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, certificate_serial, expires_at, issued_at`,
      [
        req.params.deviceId,
        certificateSerial,
        'PLACEHOLDER_CERTIFICATE_PEM', // Would be actual certificate
        'PLACEHOLDER_PRIVATE_KEY_PEM', // Would be encrypted private key
        expiresAt.toISOString()
      ]
    );
    
    res.status(201).json({
      success: true,
      data: {
        certificateId: result.rows[0].id,
        serial: result.rows[0].certificate_serial,
        expiresAt: result.rows[0].expires_at,
        issuedAt: result.rows[0].issued_at
      }
    });
  } catch (error) {
    console.error('Error generating device certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate certificate'
    });
  }
});

// Get device certificates
router.get('/:deviceId/certificates', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    
    const result = await client.query(
      `SELECT dc.id, dc.certificate_serial, dc.issued_at, dc.expires_at, dc.revoked_at, dc.revocation_reason
       FROM device_certificates dc
       JOIN devices d ON dc.device_id = d.id
       WHERE dc.device_id = $1 AND d.account_id = $2
       ORDER BY dc.issued_at DESC`,
      [req.params.deviceId, req.accountId]
    );
    
    res.json({
      success: true,
      data: result.rows.map(cert => ({
        certificateId: cert.id,
        serial: cert.certificate_serial,
        issuedAt: cert.issued_at,
        expiresAt: cert.expires_at,
        isRevoked: cert.revoked_at !== null,
        revokedAt: cert.revoked_at,
        revocationReason: cert.revocation_reason
      }))
    });
  } catch (error) {
    console.error('Error fetching device certificates:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Revoke device certificate
router.delete('/:deviceId/certificates/:certificateId', requireAuth, 
  validateBody(z.object({
    reason: z.string().max(255).optional()
  })), async (req, res) => {
  try {
    const client = await getDbClient();
    
    const result = await client.query(
      `UPDATE device_certificates 
       SET revoked_at = NOW(), revocation_reason = $1
       FROM devices d
       WHERE device_certificates.id = $2 
       AND device_certificates.device_id = $3 
       AND d.id = device_certificates.device_id
       AND d.account_id = $4
       RETURNING device_certificates.id, device_certificates.certificate_serial`,
      [
        req.body.reason || 'User requested',
        req.params.certificateId,
        req.params.deviceId,
        req.accountId
      ]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not found'
      });
    }
    
    // Log certificate revocation
    await client.query(
      `INSERT INTO device_events (device_id, event_type, data, created_at)
       VALUES ($1, 'security_event', $2, NOW())`,
      [
        req.params.deviceId,
        JSON.stringify({
          action: 'certificate_revoked',
          certificateId: req.params.certificateId,
          serial: result.rows[0].certificate_serial,
          reason: req.body.reason
        })
      ]
    );
    
    res.json({
      success: true,
      message: 'Certificate revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Device-authenticated endpoints (for devices to call directly)

// Device self-update endpoint (device updates its own info)
router.put('/self', requireDeviceAuth, requireDevicePermission(['write']), validateBody(z.object({
  name: z.string().min(1).max(255).optional(),
  device_model: z.string().max(100).optional(),
  device_firmware_version: z.string().max(50).optional(),
  device_os: z.string().max(100).optional(),
  capabilities: z.record(z.any()).optional(),
  meta: z.record(z.any()).optional()
})), async (req: AuthenticatedRequest, res) => {
  try {
    const client = await getDbClient();
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (req.body.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(req.body.name);
    }
    
    if (req.body.device_model !== undefined) {
      updates.push(`device_model = $${paramCount++}`);
      values.push(req.body.device_model);
    }
    
    if (req.body.device_firmware_version !== undefined) {
      updates.push(`device_firmware_version = $${paramCount++}`);
      values.push(req.body.device_firmware_version);
    }
    
    if (req.body.device_os !== undefined) {
      updates.push(`device_os = $${paramCount++}`);
      values.push(req.body.device_os);
    }
    
    if (req.body.capabilities !== undefined) {
      updates.push(`capabilities = $${paramCount++}`);
      values.push(JSON.stringify(req.body.capabilities));
    }
    
    if (req.body.meta !== undefined) {
      updates.push(`meta = $${paramCount++}`);
      values.push(JSON.stringify(req.body.meta));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.device!.id);
    
    const queryText = `
      UPDATE devices
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, device_model, device_firmware_version, device_os, capabilities, meta, updated_at
    `;
    
    const result = await client.query(queryText, values);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating device self:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Device location update (authenticated device endpoint)
router.post('/self/location', 
  requireDeviceAuth, 
  requireDevicePermission(['write']),
  deviceRateLimit(rateLimitPresets.locationUpdates),
  validateBody(LocationUpdateSchema), 
  async (req: AuthenticatedRequest, res) => {
  try {
    const timestamp = req.body.timestamp || new Date().toISOString();
    
    const queryText = `
      UPDATE devices
      SET
        last_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
        last_seen = $3,
        updated_at = NOW()
      WHERE id = $4
    `;
    
    const result = await query(queryText, [
      req.body.longitude,
      req.body.latitude,
      timestamp,
      req.device!.id
    ]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    // Publish location event to Kafka for geofence processing
    try {
      const kafkaProducer = getKafkaProducer();
      await kafkaProducer.publishLocationEvent({
        deviceId: req.device!.id,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        accuracy: req.body.accuracy,
        altitude: req.body.altitude,
        timestamp: timestamp
      });
    } catch (kafkaError) {
      console.error('Error publishing to Kafka:', kafkaError);
    }
    
    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Error updating device location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Device command response endpoint
router.post('/self/commands/:commandId/response', requireDeviceAuth, requireDevicePermission(['write']),
  validateBody(z.object({
    status: z.enum(['acknowledged', 'completed', 'failed']),
    response: z.record(z.any()).optional(),
    error: z.string().optional()
  })), async (req: AuthenticatedRequest, res) => {
  try {
    const client = await getDbClient();
    
    const updateTime = req.body.status === 'acknowledged' ? 'acknowledged_at' : 'completed_at';
    
    const result = await client.query(
      `UPDATE device_commands
       SET 
         status = $1,
         response = COALESCE($2, response),
         error_message = $3,
         ${updateTime} = NOW()
       WHERE id = $4 AND device_id = $5
       RETURNING id, command, status, response, error_message`,
      [
        req.body.status,
        req.body.response ? JSON.stringify(req.body.response) : null,
        req.body.error,
        req.params.commandId,
        req.device!.id
      ]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Command not found'
      });
    }
    
    // Log command completion event
    await client.query(
      `INSERT INTO device_events (device_id, event_type, data, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [
        req.device!.id,
        req.body.status === 'completed' ? 'command_completed' : 'command_failed',
        JSON.stringify({
          commandId: req.params.commandId,
          status: req.body.status,
          response: req.body.response
        })
      ]
    );
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating command response:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Device Location Ingestion (device key authentication)
router.post('/:deviceKey/location', async (req, res) => {
  try {
    const { deviceKey } = req.params;
    const locationData = req.body;
    
    if (!deviceKey || !locationData.latitude || !locationData.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Device key, latitude, and longitude required'
      });
    }
    
    const client = await getDbClient();
    
    // Verify device exists and get account info
    const deviceResult = await client.query(
      `SELECT id, account_id, name 
       FROM devices 
       WHERE device_key = $1 AND is_paired = true`,
      [deviceKey]
    );
    
    if (deviceResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid device key'
      });
    }
    
    const device = deviceResult.rows[0];
    
    // Insert location event
    const locationResult = await client.query(
      `INSERT INTO location_events (
        account_id, device_id, ts, loc, speed_mps, accuracy_m, battery_pct, payload
      ) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8, $9)
      RETURNING id`,
      [
        device.account_id,
        device.id,
        new Date(locationData.timestamp || Date.now()),
        locationData.longitude,
        locationData.latitude,
        locationData.speed || 0,
        locationData.accuracy || 10,
        locationData.battery || 100,
        JSON.stringify(locationData.metadata || {})
      ]
    );
    
    // Update device status
    await client.query(
      `UPDATE devices 
       SET status = 'online', last_heartbeat = NOW()
       WHERE id = $1`,
      [device.id]
    );
    
    // Check for geofence events (simplified version)
    const geofenceResult = await client.query(
      `SELECT g.id, g.name, g.type,
        ST_Contains(g.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) as inside
       FROM geofences g 
       WHERE g.account_id = $3 AND g.active = true`,
      [locationData.longitude, locationData.latitude, device.account_id]
    );
    
    const geofenceEvents = [];
    for (const geofence of geofenceResult.rows) {
      if (geofence.inside) {
        // This is a simplified check - in reality you'd need to track enter/exit events
        geofenceEvents.push({
          type: 'enter',
          geofenceId: geofence.id,
          geofenceName: geofence.name
        });
      }
    }
    
    res.json({
      success: true,
      locationId: locationResult.rows[0].id,
      geofenceEvents: geofenceEvents,
      message: 'Location received successfully'
    });
    
  } catch (error) {
    console.error('Error processing location data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process location data'
    });
  }
});

// ESP32/IoT Device Pairing Validation (no auth required)
router.post('/pairing/validate', async (req, res) => {
  try {
    const { pairingCode, deviceName, deviceType } = req.body;
    
    if (!pairingCode || !deviceName) {
      return res.status(400).json({
        success: false,
        error: 'Pairing code and device name required'
      });
    }
    
    const client = await getDbClient();
    
    // Find valid pairing request
    const pairingResult = await client.query(
      `SELECT id, account_id, expires_at 
       FROM device_pairing_requests 
       WHERE pairing_code = $1 
       AND expires_at > NOW() 
       AND used_at IS NULL`,
      [pairingCode]
    );
    
    if (pairingResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired pairing code'
      });
    }
    
    const pairing = pairingResult.rows[0];
    
    // Generate device key and create device
    const deviceKey = Array.from({length: 32}, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
    ).join('');
    
    // Create device record
    const deviceResult = await client.query(
      `INSERT INTO devices (
        name, account_id, device_key, device_type, device_model, 
        connection_type, status, is_paired, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, name, device_key`,
      [
        deviceName, 
        pairing.account_id, 
        deviceKey,
        deviceType || 'esp32',
        'ESP32',
        'mqtt',
        'offline',
        true
      ]
    );
    
    // Mark pairing request as used
    await client.query(
      `UPDATE device_pairing_requests 
       SET used_at = NOW() 
       WHERE pairing_code = $1`,
      [pairingCode]
    );
    
    const device = deviceResult.rows[0];
    
    // Return configuration for ESP32
    res.json({
      success: true,
      deviceKey: device.device_key,
      deviceId: device.id,
      serverUrl: process.env.API_BASE_URL || 'http://localhost:3001',
      mqttServer: process.env.MQTT_BROKER_HOST || 'localhost',
      mqttPort: parseInt(process.env.MQTT_BROKER_PORT || '1883'),
      message: 'Device paired successfully!'
    });
    
  } catch (error) {
    console.error('Error validating pairing code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate pairing code'
    });
  }
});

export { router as deviceRoutes };
