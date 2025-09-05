import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '@geofence/db';
import { auth } from '../config/index.js';
import { encryptData, decryptData, hashData } from './encryption.js';

const JWT_SECRET = auth.JWT_SECRET;

// Device JWT payload schema
export interface DeviceJWTPayload {
  deviceId: string;
  accountId: string;
  sessionId: string;
  permissions: string[];
  iat: number;
  exp: number;
}

// Device registration schema
export const DeviceRegistrationSchema = z.object({
  name: z.string().min(1).max(255),
  deviceModel: z.string().max(100).optional(),
  deviceFirmwareVersion: z.string().max(50).optional(),
  deviceOs: z.string().max(100).optional(),
  capabilities: z.record(z.any()).optional(),
  meta: z.record(z.any()).optional()
});

// Device token response schema
export const DeviceTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  refreshExpiresIn: z.number(),
  deviceId: z.string(),
  deviceInfo: z.object({
    name: z.string(),
    status: z.string(),
    lastSeen: z.string()
  })
});

/**
 * Generate device access and refresh tokens
 */
export async function generateDeviceTokens(
  deviceId: string,
  accountId: string,
  permissions: string[] = ['read', 'write']
): Promise<{
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresIn: number;
  refreshExpiresIn: number;
}> {
  const sessionId = crypto.randomUUID();

  try {
    // Generate tokens
    const accessPayload: Omit<DeviceJWTPayload, 'iat' | 'exp'> = {
      deviceId,
      accountId,
      sessionId,
      permissions
    };

    const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // Calculate expiration times
    const now = Math.floor(Date.now() / 1000);
    const accessTokenData = jwt.decode(accessToken) as any;
    const expiresIn = accessTokenData.exp - now;
    const refreshExpiresIn = 30 * 24 * 60 * 60; // 30 days

    // Hash tokens for secure storage
    const accessTokenHash = hashData(accessToken);
    const refreshTokenHash = hashData(refreshToken);

    // Store session in database
    await query(
      `INSERT INTO device_sessions (
        device_id, access_token_hash, refresh_token_hash,
        expires_at, refresh_expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        deviceId,
        accessTokenHash,
        refreshTokenHash,
        new Date(Date.now() + (expiresIn * 1000)).toISOString(),
        new Date(Date.now() + (refreshExpiresIn * 1000)).toISOString()
      ]
    );

    return {
      accessToken,
      refreshToken,
      sessionId,
      expiresIn,
      refreshExpiresIn
    };
  } catch (error) {
    console.error('Error generating device tokens:', error);
    throw new Error('Failed to generate device tokens');
  }
}

/**
 * Complete device pairing using pairing code
 */
export async function completeDevicePairing(
  pairingCode: string,
  deviceInfo: z.infer<typeof DeviceRegistrationSchema>
): Promise<z.infer<typeof DeviceTokenResponseSchema> | null> {
  try {
    // Find pairing request
    const pairingRequestResult = await query(
      `SELECT dpr.*, d.id as device_id, d.account_id, d.account_id
       FROM device_pairing_requests dpr
       JOIN devices d ON dpr.pairing_code = d.pairing_code
       WHERE dpr.pairing_code = $1 AND dpr.expires_at > NOW() AND dpr.used_at IS NULL`,
      [pairingCode]
    );

    if (pairingRequestResult.rowCount === 0) {
      return null;
    }

    const pairingRequest = pairingRequestResult.rows[0];
    const deviceId = pairingRequest.device_id;
    const accountId = pairingRequest.account_id;

    await query('BEGIN');

    // Mark pairing request as used
    await query(
      'UPDATE device_pairing_requests SET used_at = NOW() WHERE id = $1',
      [pairingRequest.id]
    );

    // Update device as paired and set ownership
    await query(
      `UPDATE devices SET
         is_paired = true,
         pairing_code = NULL,
         pairing_expires_at = NULL,
         status = 'online',
         last_heartbeat = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [deviceId]
    );

    // Create device-user association (owner permission)
    await query(
      `INSERT INTO device_users (device_id, user_id, account_id, permissions, granted_by)
       VALUES ($1, $2, $3, 'owner', $2)
       ON CONFLICT (device_id, user_id) DO NOTHING`,
      [deviceId, pairingRequest.created_by, accountId]
    );

    // Generate tokens
    const tokens = await generateDeviceTokens(deviceId, accountId, accountId);

    await query('COMMIT');

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn,
      deviceId,
      deviceInfo: {
        name: deviceInfo.name,
        status: 'online',
        lastSeen: new Date().toISOString()
      }
    };
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error completing device pairing:', error);
    throw new Error('Failed to complete device pairing');
  }
}

/**
 * Clean up expired pairing requests
 */
export async function cleanupExpiredPairingRequests(): Promise<number> {
  try {
    const result = await query(
      'DELETE FROM device_pairing_requests WHERE expires_at < NOW() AND used_at IS NULL'
    );

    // Also clean up expired device pairings
    await query(
      `UPDATE devices SET
         pairing_code = NULL,
         pairing_expires_at = NULL
       WHERE pairing_expires_at < NOW() AND is_paired = false`
    );

    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Error cleaning up expired pairing requests:', error);
    return 0;
  }
}

// Device pairing schema
export const DevicePairingSchema = z.object({
  pairingCode: z.string().regex(/^[A-Z0-9]{10}$/),
  deviceData: DeviceRegistrationSchema
});
