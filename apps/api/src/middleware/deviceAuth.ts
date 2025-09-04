import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDbClient } from '../db/client.js';
import { auth } from '../config/index.js';
import { DeviceJWTPayload } from '../utils/deviceAuth.js';
import { hashData } from '../utils/encryption.js';

interface AuthenticatedRequest extends Request {
  device?: {
    id: string;
    accountId: string;
    sessionId: string;
    permissions: string[];
  };
}

/**
 * Middleware to authenticate device requests using device JWT tokens
 */
export const requireDeviceAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing access token'
      });
    }

    // Verify JWT token
    let payload: DeviceJWTPayload;
    try {
      payload = jwt.verify(token, auth.JWT_SECRET) as DeviceJWTPayload;
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Check if session exists and is not revoked
    const client = await getDbClient();
    const tokenHash = hashData(token);
    
    const sessionResult = await client.query(
      `SELECT ds.*, d.name as device_name, d.status as device_status
       FROM device_sessions ds
       JOIN devices d ON ds.device_id = d.id
       WHERE ds.access_token_hash = $1 
       AND ds.expires_at > NOW() 
       AND ds.is_revoked = false`,
      [tokenHash]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Session not found or expired'
      });
    }

    const session = sessionResult.rows[0];

    // Update last used timestamp
    await client.query(
      'UPDATE device_sessions SET last_used_at = NOW() WHERE id = $1',
      [session.id]
    );

    // Add device info to request
    req.device = {
      id: payload.deviceId,
      accountId: payload.accountId,
      sessionId: payload.sessionId,
      permissions: payload.permissions
    };

    next();
  } catch (error) {
    console.error('Device authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication service error'
    });
  }
};

/**
 * Middleware to check device permissions
 */
export const requireDevicePermission = (requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.device) {
      return res.status(401).json({
        success: false,
        error: 'Device not authenticated'
      });
    }

    const hasPermission = requiredPermissions.some(permission => 
      req.device!.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Optional device authentication - doesn't fail if no token provided
 */
export const optionalDeviceAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }

    try {
      const payload = jwt.verify(token, auth.JWT_SECRET) as DeviceJWTPayload;
      
      // Check if session exists
      const client = await getDbClient();
      const tokenHash = hashData(token);
      
      const sessionResult = await client.query(
        `SELECT ds.*, d.name as device_name
         FROM device_sessions ds
         JOIN devices d ON ds.device_id = d.id
         WHERE ds.access_token_hash = $1 
         AND ds.expires_at > NOW() 
         AND ds.is_revoked = false`,
        [tokenHash]
      );

      if (sessionResult.rows.length > 0) {
        // Update last used timestamp
        await client.query(
          'UPDATE device_sessions SET last_used_at = NOW() WHERE id = $1',
          [sessionResult.rows[0].id]
        );

        req.device = {
          id: payload.deviceId,
          accountId: payload.accountId,
          sessionId: payload.sessionId,
          permissions: payload.permissions
        };
      }
    } catch (error) {
      // Invalid token, but we don't fail - just continue without device auth
    }

    next();
  } catch (error) {
    console.error('Optional device authentication error:', error);
    next(); // Continue without authentication
  }
};

/**
 * Middleware to validate device owns resource
 */
export const requireDeviceOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.device) {
    return res.status(401).json({
      success: false,
      error: 'Device not authenticated'
    });
  }

  // Check if the device ID in the URL matches the authenticated device
  const deviceIdParam = req.params.deviceId;
  
  if (deviceIdParam && deviceIdParam !== req.device.id) {
    return res.status(403).json({
      success: false,
      error: 'Cannot access other device resources'
    });
  }

  next();
};

export type { AuthenticatedRequest };