import { Router } from 'express';
import { z } from 'zod';
import { getDbClient, query, queryWithTimeout } from '../db/client.js';
import { requireOrganization, validateBody } from '../middleware/validation.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
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
  meta: z.record(z.any()).optional()
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
router.post('/',requireAuth, requireOrganization, validateBody(CreateDeviceSchema), async (req, res) => {
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

// Get specific device
router.get('/:deviceId', requireAuth, requireOrganization, async (req, res) => {
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
router.put('/:deviceId', requireAuth, requireOrganization, validateBody(UpdateDeviceSchema), async (req, res) => {
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
router.delete('/:deviceId', requireAuth, requireOrganization, async (req, res) => {
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
router.post('/:deviceId/location', validateBody(LocationUpdateSchema), async (req, res) => {
  try {
    const timestamp = req.body.timestamp || new Date().toISOString();

    const queryText = `
      UPDATE devices
      SET
        last_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
        last_seen = $3,
        updated_at = NOW()
      WHERE device_token = $4
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
router.post('/pairing/generate', optionalAuth, async (req, res) => {
  try {
    console.log('Generating pairing code - starting...');
    const client = await getDbClient();
    console.log('Database client connected');

    // For development/testing, get first available account if not set
    let accountId = req.accountId;
    let organizationId = req.organizationId;

    console.log(`Initial values - accountId: ${accountId}, organizationId: ${organizationId}`);

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

    if (!organizationId) {
      const orgResult = await client.query('SELECT id, name FROM organizations ORDER BY created_at LIMIT 1');
      console.log('Organization query result:', orgResult.rows);
      if (orgResult.rows.length > 0) {
        organizationId = orgResult.rows[0].id;
        console.log(`Using found organization: ${organizationId}`);
      } else {
        // Try to create a default organization if none exist
        console.log('No organizations found, attempting to create default');
        try {
          const defaultOrgResult = await client.query(
            'INSERT INTO organizations (name, owner_id) VALUES ($1, (SELECT id FROM users ORDER BY created_at LIMIT 1)) RETURNING id',
            ['Default Organization']
          );
          if (defaultOrgResult.rows.length > 0) {
            organizationId = defaultOrgResult.rows[0].id;
            console.log(`Created default organization: ${organizationId}`);
          } else {
            // Fallback: set organizationId to null
            organizationId = undefined;
            console.log('Failed to create default organization, setting to null');
          }
        } catch (orgCreateError) {
          console.error('Failed to create default organization:', orgCreateError);
          organizationId = undefined;
        }
      }
    }

    console.log(`Using organizationId: ${organizationId}`);

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
        pairing_code, account_id, organization_id, expires_at, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, pairing_code, expires_at`,
      [pairingCode, accountId, organizationId, expiresAt.toISOString(), createdBy]
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
router.post('/pairing/complete', validateBody(DevicePairingSchema), async (req, res) => {
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
router.get('/:deviceId/status', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    const result = await client.query(
      `SELECT id, name, status, last_heartbeat, health_metrics, capabilities,
              connection_type, ip_address, mac_address, device_model,
              device_firmware_version, device_os, is_paired,
              EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) as seconds_since_heartbeat
       FROM devices
       WHERE id = $1 AND organization_id = $2`,
      [req.params.deviceId, req.organizationId]
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

// Device sharing endpoints

// Share device with another user
router.post('/:deviceId/share', requireAuth, requireOrganization,
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
      `INSERT INTO device_users (device_id, user_id, organization_id, permissions, granted_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (device_id, user_id) DO UPDATE SET
         permissions = EXCLUDED.permissions,
         granted_by = EXCLUDED.granted_by`,
      [
        req.params.deviceId,
        req.body.targetUserId,
        req.organizationId,
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
router.get('/:deviceId/users', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    const result = await client.query(
      `SELECT du.user_id, du.permissions, du.granted_at,
              u.name, u.email
       FROM device_users du
       JOIN users u ON du.user_id = u.id
       WHERE du.device_id = $1 AND du.organization_id = $2`,
      [req.params.deviceId, req.organizationId]
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

export { router as deviceRoutes };
